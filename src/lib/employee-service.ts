"use server";

import type { Employee, Payslip, SalaryIncrement, LeaveRecord } from '@/types';
import { subYears } from 'date-fns';
import { query } from './mysql';
import { v4 as uuidv4 } from 'uuid';
import { guard } from '@/lib/guard';

const EMPLOYEES_TABLE = 'employees';
const SALARY_RECORDS_TABLE = 'salary_records';

const defaultEmployeesData: Array<Omit<Employee, 'id' | 'employeeId' | 'userId'>> = [
    { name: 'John Doe', email: 'john.doe@example.com', mobileNo: '01712345678', dob: subYears(new Date(), 30).toISOString(), designation: 'Software Engineer', joiningDate: subYears(new Date(), 2).toISOString(), status: 'Active', salary: 80000, yearlyLeave: 12, leaveTaken: 0, leaveHistory: [], nationalId: '1234567890123', accountNo: '112233445566' },
    { name: 'Jane Smith', email: 'jane.smith@example.com', mobileNo: '01812345678', dob: subYears(new Date(), 25).toISOString(), designation: 'Project Manager', joiningDate: subYears(new Date(), 1).toISOString(), status: 'Active', salary: 95000, yearlyLeave: 12, leaveTaken: 0, leaveHistory: [], nationalId: '9876543210987', accountNo: '665544332211' },
];

export const seedDefaultEmployees = async (): Promise<Employee[]> => {
  await guard();
    const createdEmployees: Employee[] = [];
    let counter = 1;

    for (const empData of defaultEmployeesData) {
        const employeeId = `EMP-${String(counter++).padStart(3, '0')}`;
        const newEmployeeData = {
            ...empData,
            employeeId,
            userId: null,
        };
        try {
            const newEmployee = await addEmployee(newEmployeeData);
            if (newEmployee) {
                createdEmployees.push(newEmployee);
            }
        } catch (error) {
            console.error(`Error seeding employee ${empData.name}:`, error);
        }
    }

    return createdEmployees;
};

export const getEmployees = async (): Promise<Employee[]> => {
  await guard();
    try {
        const rows = await query<any[]>(`SELECT id, data_json FROM ${EMPLOYEES_TABLE} ORDER BY employee_id ASC`);
        return rows.map(row => ({
            id: row.id,
            ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
        } as Employee));
    } catch (error) {
        console.error("Error fetching employees from MySQL:", error);
        return [];
    }
};

export const getEmployeesPaginated = async (
    page: number = 1,
    limit: number = 50,
    searchTerm?: string,
    statusFilter?: string
): Promise<{ employees: Employee[]; total: number }> => {
  await guard();
    const allEmployees = await getEmployees();
    let results = [...allEmployees];
    if (statusFilter && statusFilter !== 'all') {
        results = results.filter(e => e.status === statusFilter);
    }
    if (searchTerm && searchTerm.trim()) {
        const lower = searchTerm.toLowerCase();
        results = results.filter(e =>
            e.name.toLowerCase().includes(lower) ||
            (e.email && e.email.toLowerCase().includes(lower)) ||
            e.employeeId.toLowerCase().includes(lower) ||
            e.designation.toLowerCase().includes(lower) ||
            e.mobileNo.includes(searchTerm)
        );
    }
    const total = results.length;
    const startIndex = (page - 1) * limit;
    return { employees: results.slice(startIndex, startIndex + limit), total };
};

export const getEmployeeById = async (id: string): Promise<Employee | null> => {
  await guard();
    if (!id) return null;
    try {
        const rows = await query<any[]>(`SELECT id, data_json FROM ${EMPLOYEES_TABLE} WHERE id = ? OR employee_id = ?`, [id, id]);
        if (rows.length > 0) {
            return { id: rows[0].id, ...(typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json) } as Employee;
        }
        return null;
    } catch (error) {
        console.error(`Error fetching employee ${id} from MySQL:`, error);
        return null;
    }
};

export const addEmployee = async (employeeData: Omit<Employee, 'id' | 'employeeId'>): Promise<Employee | null> => {
  await guard();
    try {
        const allEmployees = await getEmployees();
        let maxIdNumber = 0;
        allEmployees.forEach(emp => {
            if (emp.employeeId && emp.employeeId.startsWith('EMP-')) {
                const numPart = parseInt(emp.employeeId.split('-')[1], 10);
                if (!isNaN(numPart) && numPart > maxIdNumber) {
                    maxIdNumber = numPart;
                }
            }
        });

        const newIdNumber = maxIdNumber + 1;
        const employeeId = `EMP-${String(newIdNumber).padStart(3, '0')}`;
        const newEmployeeData = {
            ...employeeData,
            employeeId,
            nationalId: employeeData.nationalId || `${new Date().getFullYear()}${String(Math.floor(1000 + Math.random() * 9000))}`,
            salaryHistory: [],
            yearlyLeave: employeeData.yearlyLeave || 12,
            leaveTaken: employeeData.leaveTaken || 0,
            leaveHistory: employeeData.leaveHistory || [],
            providentFundStatus: employeeData.providentFundStatus || 'Active',
        };

        const id = uuidv4();
        await query(`INSERT INTO ${EMPLOYEES_TABLE} (id, user_id, employee_id, name, data_json) VALUES (?, ?, ?, ?, ?)`,
            [id, newEmployeeData.userId || null, employeeId, newEmployeeData.name || '', JSON.stringify(newEmployeeData)]);

        return { id, ...newEmployeeData } as Employee;
    } catch (error) {
        console.error("Error adding employee to MySQL:", error);
        return null;
    }
};

export const updateEmployee = async (employeeId: string, updates: Partial<Omit<Employee, 'id' | 'employeeId'>> & { isReverting?: boolean }, incrementDate?: string): Promise<boolean> => {
  await guard();
    try {
        const existingEmployee = await getEmployeeById(employeeId);
        if (!existingEmployee) {
            throw new Error("Employee not found for update.");
        }

        const finalUpdates = { ...updates };
        const currentSalary = existingEmployee.salary || 0;
        const newSalary = updates.salary;

        if (updates.status && updates.status !== existingEmployee.status) {
            finalUpdates.statusChangeDate = new Date().toISOString();
        }

        if (newSalary !== undefined && newSalary !== null && newSalary !== currentSalary) {
            if (!finalUpdates.isReverting) {
                const newIncrement: SalaryIncrement = {
                    date: incrementDate || new Date().toISOString(),
                    previousSalary: currentSalary,
                    newSalary: newSalary,
                    incrementAmount: (newSalary || 0) - currentSalary,
                };
                finalUpdates.salaryHistory = [newIncrement, ...(existingEmployee.salaryHistory || [])];
            }
        }

        delete finalUpdates.isReverting;
        const finalData = { ...existingEmployee, ...finalUpdates };
        const id = finalData.id;
        delete (finalData as any).id;

        await query(`UPDATE ${EMPLOYEES_TABLE} SET user_id = ?, name = ?, data_json = ? WHERE id = ?`,
            [finalData.userId || null, finalData.name || '', JSON.stringify(finalData), id]);

        return true;
    } catch (error) {
        console.error(`Error updating employee ${employeeId} in MySQL:`, error);
        return false;
    }
};

export const deleteEmployee = async (employeeId: string): Promise<boolean> => {
  await guard();
    try {
        await query(`DELETE FROM ${EMPLOYEES_TABLE} WHERE id = ? OR employee_id = ?`, [employeeId, employeeId]);
        return true;
    } catch (error) {
        console.error(`Error deleting employee ${employeeId} from MySQL:`, error);
        return false;
    }
};

export const getPayslipForMonth = async (month: string): Promise<Payslip[]> => {
  await guard();
    try {
        const rows = await query<any[]>(`SELECT id, data_json FROM ${SALARY_RECORDS_TABLE} WHERE month = ?`, [month]);
        return rows.map(row => ({
            id: row.id,
            ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
        } as Payslip));
    } catch (error) {
        console.error(`Error fetching payslips for ${month} from MySQL:`, error);
        return [];
    }
};

export const updatePayslipInDb = async (payslipId: string, payslipData: Omit<Payslip, 'id' | 'updatedAt' | 'employeeId'>): Promise<boolean> => {
  await guard();
    const month = payslipId.substring(0, 7);
    const employeeId = payslipId.substring(8);
    try {
        const existingRows = await query<any[]>(`SELECT data_json FROM ${SALARY_RECORDS_TABLE} WHERE id = ?`, [payslipId]);
        const existingData = existingRows.length > 0 ? (typeof existingRows[0].data_json === 'string' ? JSON.parse(existingRows[0].data_json) : existingRows[0].data_json) : {};

        const dataToSave = {
            ...existingData,
            ...payslipData,
            employeeId: employeeId,
            updatedAt: new Date().toISOString(),
        };

        await query(`INSERT INTO ${SALARY_RECORDS_TABLE} (id, employee_id, month, data_json) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE employee_id=VALUES(employee_id), month=VALUES(month), data_json=VALUES(data_json)`,
            [payslipId, employeeId, month, JSON.stringify(dataToSave)]);

        return true;
    } catch (error) {
        console.error(`Error updating payslip ${payslipId} in MySQL:`, error);
        return false;
    }
};

export const deleteSalaryIncrement = async (employeeId: string, incrementDate: string): Promise<boolean> => {
  await guard();
    try {
        const employee = await getEmployeeById(employeeId);
        if (!employee || !employee.salaryHistory) {
            throw new Error("Employee or salary history not found.");
        }
        const newHistory = employee.salaryHistory.filter(h => h.date !== incrementDate);
        return await updateEmployee(employeeId, { salaryHistory: newHistory });
    } catch (error) {
        console.error(`Error deleting salary increment for employee ${employeeId}:`, error);
        return false;
    }
};

export const addLeaveRecord = async (employeeId: string, leaveData: Omit<LeaveRecord, 'id'>, newTotalLeaveTaken?: number): Promise<boolean> => {
  await guard();
    try {
        const employee = await getEmployeeById(employeeId);
        if (!employee) throw new Error("Employee not found.");

        const newLeaveRecord: LeaveRecord = { ...leaveData, id: uuidv4() };
        const updatedHistory = [...(employee.leaveHistory || []), newLeaveRecord];
        const newLeaveTaken = newTotalLeaveTaken !== undefined ? newTotalLeaveTaken : (employee.leaveTaken || 0) + leaveData.days;

        return await updateEmployee(employeeId, {
            leaveHistory: updatedHistory,
            leaveTaken: newLeaveTaken,
        });
    } catch (error) {
        console.error(`Error adding leave record for employee ${employeeId}:`, error);
        return false;
    }
};

export const deleteLeaveRecord = async (employeeId: string, leaveRecordId: string): Promise<boolean> => {
  await guard();
    try {
        const employee = await getEmployeeById(employeeId);
        if (!employee) throw new Error("Employee not found.");

        const leaveHistory = employee.leaveHistory || [];
        const updatedHistory = leaveHistory.filter(record => record.id !== leaveRecordId);
        if (leaveHistory.length === updatedHistory.length) return false;

        const newLeaveTaken = updatedHistory.reduce((total, record) => total + record.days, 0);
        return await updateEmployee(employeeId, {
            leaveHistory: updatedHistory,
            leaveTaken: newLeaveTaken,
        });
    } catch (error) {
        console.error(`Error deleting leave record ${leaveRecordId} for employee ${employeeId}:`, error);
        return false;
    }
};
