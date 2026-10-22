
"use server";

import { revalidatePath } from "next/cache";
import type { Employee, Payslip, SalaryIncrement, LeaveRecord, User, ProvidentFundRecord } from "@/types";
import {
  addEmployee as addEmployeeService,
  updateEmployee as updateEmployeeService,
  deleteEmployee as deleteEmployeeService,
  getEmployeeById,
  deleteSalaryIncrement as deleteSalaryIncrementService,
  addLeaveRecord as addLeaveRecordService,
  deleteLeaveRecord as deleteLeaveRecordService,
  getPayslipForMonth,
  updatePayslipInDb,
} from "@/lib/employee-service";
import { addOrUpdateAttendanceRecord, deleteAttendanceRecord } from "@/lib/attendance-service";
import { updateProvidentFundRecord, getProvidentFundRecords } from "@/lib/provident-fund-service";
import { query } from "@/lib/mysql";
import { WEEK_DAYS } from "@/lib/payroll-days";

export async function addEmployeeAction(
  employeeData: Omit<Employee, 'id' | 'employeeId'>
): Promise<{ success: boolean; employee?: Employee; error?: string }> {
  try {
    if (employeeData.mobileNo) {
      const phoneRegex = /^0\d{10}$/;
      if (!phoneRegex.test(employeeData.mobileNo)) {
        return { success: false, error: "Invalid mobile number. It must be an 11-digit number starting with 0." };
      }
    }
    const newEmployee = await addEmployeeService(employeeData);
    if (newEmployee) {
      revalidatePath("/(app)/payroll");
      return { success: true, employee: newEmployee };
    }
    return { success: false, error: "Failed to add employee to database." };
  } catch (error) {
    console.error("Error in addEmployeeAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updateEmployeeAction(
  employeeId: string,
  updates: Partial<Omit<Employee, 'id' | 'employeeId'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    if (updates.mobileNo) {
      const phoneRegex = /^0\d{10}$/;
      if (!phoneRegex.test(updates.mobileNo)) {
        return { success: false, error: "Invalid mobile number. It must be an 11-digit number starting with 0." };
      }
    }
    if (updates.weekendDays && (!Array.isArray(updates.weekendDays) || updates.weekendDays.some(d => !WEEK_DAYS.includes(d)))) {
      return { success: false, error: "Invalid weekend days." };
    }
    const success = await updateEmployeeService(employeeId, updates);
    if (success) {
      revalidatePath("/(app)/payroll");
      return { success: true };
    }
    return { success: false, error: "Failed to update employee in database." };
  } catch (error) {
    console.error("Error in updateEmployeeAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function deleteEmployeeAction(employeeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await deleteEmployeeService(employeeId);
    if (success) {
      revalidatePath("/(app)/payroll");
      return { success: true };
    }
    return { success: false, error: "Failed to delete employee from database." };
  } catch (error) {
    console.error("Error in deleteEmployeeAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function updatePayslipAction(
  payslipId: string,
  payslipData: Omit<Payslip, "id" | "updatedAt" | "employeeId">
): Promise<{ success: boolean; error?: string }> {
  try {
    const month = payslipId.substring(0, 7);
    const employeeId = payslipId.substring(8);

    // Fetch previous state to detect transitions
    const existingPayslips = await getPayslipForMonth(month);
    const prevPayslip = existingPayslips.find((p) => p.employeeId === employeeId);
    const prevStatus = prevPayslip?.paymentStatus || "Unpaid";

    const success = await updatePayslipInDb(payslipId, payslipData);
    if (success) {
      const employee = await getEmployeeById(employeeId);

      if (employee && employee.providentFundStatus === "Active") {
        const pfRecords = await getProvidentFundRecords(employeeId);
        const existingPF = pfRecords.find((r: ProvidentFundRecord) => r.id === payslipId);

        if (payslipData.paymentStatus === "Paid") {
          // If marked as Paid, ensure a PF record exists with the amount
          // Only update if it doesn't exist OR if the amount is currently 0 (meaning it was reset)
          // OR if the salary deduction amount changed.
          const needsAddition = !existingPF || existingPF.amount === 0 || existingPF.amount !== payslipData.providentFund;

          if (needsAddition) {
            await updateProvidentFundRecord({
              id: payslipId,
              employeeId,
              employeeName: employee.name,
              month,
              amount: payslipData.providentFund,
              status: existingPF?.status || "Unpaid", // Preserve manual status if exists
              updatedAt: new Date().toISOString(),
            });
          }
        } else {
          // If marked as Unpaid, ensure PF amount is reset to 0
          if (existingPF && existingPF.amount > 0) {
            await updateProvidentFundRecord({
              id: payslipId,
              employeeId,
              employeeName: employee.name,
              month,
              amount: 0,
              status: "Unpaid",
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      revalidatePath("/(app)/payroll");
      return { success: true };
    }
    return { success: false, error: "Failed to update payslip in database." };
  } catch (error) {
    console.error("Error in updatePayslipAction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unexpected error occurred.",
    };
  }
}

export async function bulkUpdateProvidentFundAction(
  updates: {
    payslipId: string;
    employeeId: string;
    employeeName: string;
    month: string;
    amount: number;
    status: 'Paid' | 'Unpaid';
  }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const update of updates) {
      await updateProvidentFundRecord({
        id: update.payslipId,
        employeeId: update.employeeId,
        employeeName: update.employeeName,
        month: update.month,
        amount: update.amount,
        status: update.status,
        updatedAt: new Date().toISOString()
      });

      const existingPayslips = await getPayslipForMonth(update.month);
      const existingPayslip = existingPayslips.find(p => p.employeeId === update.employeeId);

      if (existingPayslip) {
        const { id, ...dataToSave } = existingPayslip;
        await updatePayslipInDb(update.payslipId, {
          ...dataToSave,
          providentFund: update.amount,
        });
      } else {
        const employee = await getEmployeeById(update.employeeId);
        if (employee) {
          const payslipData: Omit<Payslip, 'id' | 'updatedAt' | 'employeeId'> = {
            presentDays: 30,
            absentDays: 0,
            lateDays: 0,
            fine: 0,
            incentive: employee.incentive || 0,
            trainingFee: 0,
            advance: 0,
            providentFund: update.amount,
            paymentStatus: 'Unpaid',
            payableAmount: (employee.salary || 0) + (employee.incentive || 0) - update.amount
          };
          await updatePayslipInDb(update.payslipId, payslipData);
        }
      }
    }
    revalidatePath("/(app)/payroll");
    return { success: true };
  } catch (error) {
    console.error("Error in bulkUpdateProvidentFundAction:", error);
    return { success: false, error: "Failed to update one or more records." };
  }
}

export async function getSalarySheetForMonth(month: string): Promise<Payslip[]> {
  try {
    const payslips = await getPayslipForMonth(month);
    return payslips;
  } catch (error) {
    console.error("Error getting salary sheet for month:", error);
    return [];
  }
}


export async function incrementEmployeeSalaryAction(
  employeeId: string,
  incrementAmount: number,
  incrementDate: string
): Promise<{ success: boolean; error?: string }> {
  if (incrementAmount <= 0) {
    return { success: false, error: "Increment amount must be positive." };
  }
  try {
    const employee = await getEmployeeById(employeeId);
    if (!employee) {
      return { success: false, error: "Employee not found." };
    }
    const currentSalary = employee.salary || 0;
    const newSalary = currentSalary + incrementAmount;

    const success = await updateEmployeeService(employeeId, { salary: newSalary }, incrementDate);
    if (success) {
      revalidatePath("/(app)/payroll");
      return { success: true };
    }
    return { success: false, error: "Failed to update employee's salary." };
  } catch (error) {
    console.error("Error in incrementEmployeeSalaryAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected server error occurred." };
  }
}

export async function deleteSalaryIncrementAction(
  employeeId: string,
  incrementDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await deleteSalaryIncrementService(employeeId, incrementDate);
    if (success) {
      revalidatePath("/(app)/payroll");
      return { success: true };
    }
    return { success: false, error: "Failed to delete salary increment history." };
  } catch (error) {
    console.error("Error in deleteSalaryIncrementAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}


// New action for adding leave
export async function addLeaveRecordAction(
  employeeId: string,
  leaveData: Omit<LeaveRecord, 'id'>,
  newTotalLeaveTaken?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await addLeaveRecordService(employeeId, leaveData, newTotalLeaveTaken);
    if (success) {
      // Record attendance as Paid Leave
      const employee = await getEmployeeById(employeeId);
      if (employee && employee.userId && leaveData.allDates) {
        for (const dateIso of leaveData.allDates) {
           const dateOnly = dateIso.split('T')[0];
           await addOrUpdateAttendanceRecord({
               employeeId: employee.userId,
               employeeName: employee.name,
               date: dateOnly,
               status: 'Paid Leave',
               checkInTime: dateIso,
               checkOutTime: null,
               location: 'Remote',
               hoursWorked: null,
               lateReason: null,
               earlyOutReason: null,
               checkInLocation: undefined,
               checkOutLocation: undefined
           });
        }
      }
      revalidatePath("/(app)/payroll");
      revalidatePath("/(app)/hrm/attendance");
      return { success: true };
    }
    return { success: false, error: "Failed to record leave in database." };
  } catch (error) {
    console.error("Error in addLeaveRecordAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

// New action for deleting a leave record
export async function deleteLeaveRecordAction(employeeId: string, leaveRecordId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const employee = await getEmployeeById(employeeId);
    if (!employee) return { success: false, error: "Employee not found." };
    
    const recordToDelete = employee.leaveHistory?.find(r => r.id === leaveRecordId);
    
    const success = await deleteLeaveRecordService(employeeId, leaveRecordId);
    if (success) {
      // Remove corresponding attendance records
      if (employee.userId && recordToDelete?.allDates) {
        for (const dateIso of recordToDelete.allDates) {
          const dateOnly = dateIso.split('T')[0];
          await deleteAttendanceRecord(employee.userId, dateOnly);
        }
      }
      revalidatePath("/(app)/payroll");
      revalidatePath("/(app)/hrm/attendance");
      return { success: true };
    }
    return { success: false, error: "Failed to delete leave record from database." };
  } catch (error) {
    console.error("Error in deleteLeaveRecordAction:", error);
    return { success: false, error: error instanceof Error ? error.message : "An unexpected error occurred." };
  }
}

export async function getLastAttendanceDatesAction(): Promise<Record<string, string>> {
  try {
    const results = await query<any[]>(
      `SELECT employee_id, MAX(date) as last_date FROM attendance_records GROUP BY employee_id`
    );
    const lastDates: Record<string, string> = {};
    results.forEach(row => {
      if (row.employee_id && row.last_date) {
        const dateObj = row.last_date instanceof Date ? row.last_date : new Date(row.last_date);
        lastDates[row.employee_id] = dateObj.toISOString();
      }
    });
    return lastDates;
  } catch (error) {
    console.error("Error fetching last attendance dates:", error);
    return {};
  }
}

export async function getUnpaidMonthsAction(): Promise<string[]> {
    try {
        const results = await query<any[]>(
            `SELECT DISTINCT month FROM salary_records WHERE JSON_EXTRACT(data_json, '$.paymentStatus') = 'Unpaid'`
        );
        return results.map(row => row.month);
    } catch (error) {
        console.error("Error fetching unpaid months:", error);
        return [];
    }
}
