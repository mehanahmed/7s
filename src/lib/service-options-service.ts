
"use server";

import type { ServiceModelItem, ServiceLaminationItem, ServicePaymentMethodItem, ServiceGiftItem, ServiceCourierNoteItem, ServiceVariationItem } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { query } from './mysql';
import { getOrders } from './order-service';
import { guard } from '@/lib/guard';

const MODELS_TABLE = 'service_models';
const LAMINATIONS_TABLE = 'service_laminations';
const PAYMENT_METHODS_TABLE = 'service_payment_methods';
const GIFTS_TABLE = 'service_gifts';
const VARIATIONS_TABLE = 'service_variations';

// --- Model Functions ---

const seedDefaultModels = async (): Promise<ServiceModelItem[]> => {
  const createdItems: ServiceModelItem[] = [];
  const defaultModelsData = [
    { name: "Design Charge" },
    { name: "Menu Book" },
    { name: "Pizza Box" },
    { name: "Business Card" },
    { name: "Visiting Card" },
    { name: "T-shirt" },
    { name: "Poster" },
    { name: "Sticker" },
  ];

  for (const modelData of defaultModelsData) {
    try {
      const id = uuidv4();
      const newModel: ServiceModelItem = {
        id,
        name: modelData.name,
        imageUrl: null,
        totalSold: 0
      };
      await query(`INSERT INTO ${MODELS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newModel)]);
      createdItems.push(newModel);
    } catch (error) {
      console.error(`Error seeding model "${modelData.name}" in MySQL:`, error);
    }
  }
  console.log('Default service models seeded in MySQL.');
  return createdItems;
};

export const getModels = async (): Promise<ServiceModelItem[]> => {
  await guard();
  try {
    const [rows, allOrders] = await Promise.all([
      query<any[]>(`SELECT id, data_json FROM ${MODELS_TABLE} ORDER BY id ASC`),
      getOrders()
    ]);

    let models = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as ServiceModelItem));

    if (models.length === 0) {
      console.log("No service models found, seeding defaults in MySQL.");
      models = await seedDefaultModels();
    }

    // Calculate sold counts
    const soldCounts = new Map<string, number>();
    allOrders.forEach(order => {
      order.orderItems.forEach(item => {
        soldCounts.set(item.model, (soldCounts.get(item.model) || 0) + item.quantity);
      });
    });

    // Add totalSold to each model and sort by name
    return models.map(model => ({
      ...model,
      totalSold: soldCounts.get(model.name) || 0
    })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching service models from MySQL:", error);
    return [];
  }
};

export const addModel = async (name: string, imageUrl?: string | null, description?: string | null): Promise<ServiceModelItem | null> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Model name cannot be empty.");
  }

  try {
    const id = uuidv4();
    const newModelData: ServiceModelItem = { id, name: name.trim(), description: description?.trim() || null, imageUrl: imageUrl || null, totalSold: 0 };

    await query(`INSERT INTO ${MODELS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newModelData)]);
    return newModelData;
  } catch (error) {
    console.error("Error adding service model to MySQL:", error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const updateModel = async (id: string, name: string, imageUrl?: string | null, description?: string | null): Promise<boolean> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Model name cannot be empty.");
  }

  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${MODELS_TABLE} WHERE id = ?`, [id]);
    if (rows.length === 0) {
      throw new Error("Document does not exist!");
    }

    const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const finalData = {
      id: existingData.id ?? id,
      name: name.trim(),
      description: description === undefined ? existingData.description ?? null : (description?.trim() || null),
      imageUrl: imageUrl === undefined ? existingData.imageUrl ?? null : imageUrl,
    };

    await query(`UPDATE ${MODELS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), id]);
    return true;
  } catch (error) {
    console.error("Error updating service model in MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

export const deleteModel = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${MODELS_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error("Error deleting service model from MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};


// --- Lamination Functions ---

const seedDefaultLaminations = async (): Promise<ServiceLaminationItem[]> => {
  const createdLaminations: ServiceLaminationItem[] = [];
  const defaultLaminationsData: string[] = ["None", "Glossy", "Matte", "Soft Touch", "Anti-Scuff Matte"];

  for (const name of defaultLaminationsData) {
    const id = uuidv4();
    const newLamination: ServiceLaminationItem = { id, name };
    try {
      await query(`INSERT INTO ${LAMINATIONS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newLamination)]);
      createdLaminations.push(newLamination);
    } catch (error) {
      console.error(`Error seeding lamination "${name}" in MySQL:`, error);
    }
  }
  console.log('Default service laminations seeded in MySQL.');
  return createdLaminations;
};

export const getLaminations = async (): Promise<ServiceLaminationItem[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${LAMINATIONS_TABLE} ORDER BY id ASC`);
    let laminations = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as ServiceLaminationItem));

    if (laminations.length === 0) {
      console.log("No service laminations found, seeding defaults in MySQL.");
      laminations = await seedDefaultLaminations();
    }
    return laminations.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching service laminations from MySQL:", error);
    return [];
  }
};

export const addLamination = async (name: string): Promise<ServiceLaminationItem | null> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Lamination name cannot be empty.");
  }
  try {
    const id = uuidv4();
    const newLaminationData: ServiceLaminationItem = { id, name: name.trim() };
    await query(`INSERT INTO ${LAMINATIONS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newLaminationData)]);
    return newLaminationData;
  } catch (error) {
    console.error("Error adding service lamination to MySQL:", error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const updateLamination = async (id: string, name: string): Promise<boolean> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Lamination name cannot be empty.");
  }
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${LAMINATIONS_TABLE} WHERE id = ?`, [id]);
    if (rows.length === 0) return false;
    const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const finalData = { ...existingData, name: name.trim() };
    await query(`UPDATE ${LAMINATIONS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), id]);
    return true;
  } catch (error) {
    console.error("Error updating service lamination in MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

export const deleteLamination = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${LAMINATIONS_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error("Error deleting service lamination from MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};


// --- Payment Method Functions ---

const seedDefaultPaymentMethods = async (): Promise<ServicePaymentMethodItem[]> => {
  const createdItems: ServicePaymentMethodItem[] = [];
  const defaultPaymentMethodsData: string[] = ["Cash", "Card", "Bank Transfer", "Mobile Banking", "Cheque", "Other"];

  for (const name of defaultPaymentMethodsData) {
    const id = uuidv4();
    const newItem: ServicePaymentMethodItem = { id, name };
    try {
      await query(`INSERT INTO ${PAYMENT_METHODS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newItem)]);
      createdItems.push(newItem);
    } catch (error) {
      console.error(`Error seeding payment method "${name}" in MySQL:`, error);
    }
  }
  console.log('Default payment methods seeded in MySQL.');
  return createdItems;
};


export const getPaymentMethods = async (): Promise<ServicePaymentMethodItem[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${PAYMENT_METHODS_TABLE} ORDER BY id ASC`);
    let methods = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as ServicePaymentMethodItem));

    if (methods.length === 0) {
      console.log("No payment methods found, seeding defaults in MySQL.");
      methods = await seedDefaultPaymentMethods();
    }

    // Filter out duplicates (if any)
    const uniqueMethods: ServicePaymentMethodItem[] = [];
    const seenNames = new Set<string>();
    methods.forEach((m) => {
      if (!seenNames.has(m.name)) {
        seenNames.add(m.name);
        uniqueMethods.push(m);
      }
    });
    return uniqueMethods.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching payment methods from MySQL:", error);
    return [];
  }
};


export const addPaymentMethod = async (name: string): Promise<ServicePaymentMethodItem | null> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Payment method name cannot be empty.");
  }
  try {
    const id = uuidv4();
    const newItemData: ServicePaymentMethodItem = { id, name: name.trim() };
    await query(`INSERT INTO ${PAYMENT_METHODS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newItemData)]);
    return newItemData;
  } catch (error) {
    console.error("Error adding payment method to MySQL:", error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const updatePaymentMethod = async (id: string, name: string): Promise<boolean> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Payment method name cannot be empty.");
  }
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${PAYMENT_METHODS_TABLE} WHERE id = ?`, [id]);
    if (rows.length === 0) return false;
    const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const finalData = { ...existingData, name: name.trim() };
    await query(`UPDATE ${PAYMENT_METHODS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), id]);
    return true;
  } catch (error) {
    console.error("Error updating payment method in MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

export const deletePaymentMethod = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${PAYMENT_METHODS_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error("Error deleting payment method from MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

// --- Gift Functions ---

const seedDefaultGifts = async (): Promise<ServiceGiftItem[]> => {
  const createdItems: ServiceGiftItem[] = [];
  const defaultGiftsData: string[] = ["Pen", "Mug", "Keychain"];

  for (const name of defaultGiftsData) {
    const id = uuidv4();
    const newItem: ServiceGiftItem = { id, name };
    try {
      await query(`INSERT INTO ${GIFTS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newItem)]);
      createdItems.push(newItem);
    } catch (error) {
      console.error(`Error seeding gift "${name}" in MySQL:`, error);
    }
  }
  console.log('Default gifts seeded in MySQL.');
  return createdItems;
};

export const getGifts = async (): Promise<ServiceGiftItem[]> => {
  await guard();
  try {
    const rows = await query<any[]>(`SELECT id, data_json FROM ${GIFTS_TABLE} ORDER BY id ASC`);
    let gifts = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as ServiceGiftItem));

    if (gifts.length === 0) {
      console.log("No gifts found, seeding defaults in MySQL.");
      gifts = await seedDefaultGifts();
    }
    return gifts.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching gifts from MySQL:", error);
    return [];
  }
};

export const addGift = async (name: string): Promise<ServiceGiftItem | null> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Gift name cannot be empty.");
  }
  try {
    const id = uuidv4();
    const newItemData: ServiceGiftItem = { id, name: name.trim() };
    await query(`INSERT INTO ${GIFTS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newItemData)]);
    return newItemData;
  } catch (error) {
    console.error("Error adding gift to MySQL:", error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const updateGift = async (id: string, name: string): Promise<boolean> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Gift name cannot be empty.");
  }
  try {
    const rows = await query<any[]>(`SELECT data_json FROM ${GIFTS_TABLE} WHERE id = ?`, [id]);
    if (rows.length === 0) return false;
    const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const finalData = { ...existingData, name: name.trim() };
    await query(`UPDATE ${GIFTS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), id]);
    return true;
  } catch (error) {
    console.error("Error updating gift in MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

export const deleteGift = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await query(`DELETE FROM ${GIFTS_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error("Error deleting gift from MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

// --- Courier Note Functions ---

const COURIER_NOTES_TABLE = 'service_courier_notes';

let isCourierNotesTableInitialized = false;

export const initCourierNotesTable = async () => {
  await guard();
  if (isCourierNotesTableInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${COURIER_NOTES_TABLE} (
        id VARCHAR(36) PRIMARY KEY,
        data_json JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    isCourierNotesTableInitialized = true;
  } catch (error) {
    console.error("Error creating service_courier_notes table:", error);
  }
};

const seedDefaultCourierNotes = async (): Promise<ServiceCourierNoteItem[]> => {
  const createdItems: ServiceCourierNoteItem[] = [];
  const defaultNotesData: string[] = [
    "প্রিয় রাইডার ভাই, পার্সেল এসাইন হলে কাস্টমারকে কলে বলুন কালার হাট থেকে মেনু বুক এসেছে ও সিওডি জানান। কাস্টমার অগ্রিম পেমেন্ট করেছেন এবং কাস্টমাইজড পণ্য হওয়াতে কোনোভাবেই রিটার্ন করা যাবে না। সিওডি রিসিভ ব্যাতিত পণ্য দিয়ে আসা থেকে বিরত থাকুন এবং যেকোনো প্রয়োজনে সরাসরি মার্চেন্টকে জানান। ধন্যবাদ।",
    "Please call before delivery",
    "Leave at front desk",
    "Do not bend package"
  ];

  for (const name of defaultNotesData) {
    const id = uuidv4();
    const newItem: ServiceCourierNoteItem = { id, name };
    try {
      await query(`INSERT INTO ${COURIER_NOTES_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newItem)]);
      createdItems.push(newItem);
    } catch (error) {
      console.error(`Error seeding courier note "${name}" in MySQL:`, error);
    }
  }
  console.log('Default courier notes seeded in MySQL.');
  return createdItems;
};

export const getCourierNotes = async (): Promise<ServiceCourierNoteItem[]> => {
  await guard();
  try {
    await initCourierNotesTable();
    const rows = await query<any[]>(`SELECT id, data_json FROM ${COURIER_NOTES_TABLE} ORDER BY id ASC`);
    let notes = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as ServiceCourierNoteItem));

    const fullBengaliNote = "প্রিয় রাইডার ভাই, পার্সেল এসাইন হলে কাস্টমারকে কলে বলুন কালার হাট থেকে মেনু বুক এসেছে ও সিওডি জানান। কাস্টমার অগ্রিম পেমেন্ট করেছেন এবং কাস্টমাইজড পণ্য হওয়াতে কোনোভাবেই রিটার্ন করা যাবে না। সিওডি রিসিভ ব্যাতিত পণ্য দিয়ে আসা থেকে বিরত থাকুন এবং যেকোনো প্রয়োজনে সরাসরি মার্চেন্টকে জানান। ধন্যবাদ।";

    let foundBengaliNote = false;
    for (const note of notes) {
      if (note.name && note.name.includes("প্রিয় রাইডার ভাই")) {
        foundBengaliNote = true;
        if (note.name !== fullBengaliNote) {
          note.name = fullBengaliNote;
          await updateCourierNote(note.id, fullBengaliNote);
        }
      }
    }

    if (notes.length === 0) {
      console.log("No courier notes found, seeding defaults in MySQL.");
      notes = await seedDefaultCourierNotes();
    } else if (!foundBengaliNote) {
      const added = await addCourierNote(fullBengaliNote);
      if (added) notes.push(added);
    }

    return notes.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching courier notes from MySQL:", error);
    return [];
  }
};

export const addCourierNote = async (name: string): Promise<ServiceCourierNoteItem | null> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Courier note cannot be empty.");
  }
  try {
    await initCourierNotesTable();
    const id = uuidv4();
    const newItemData: ServiceCourierNoteItem = { id, name: name.trim() };
    await query(`INSERT INTO ${COURIER_NOTES_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newItemData)]);
    return newItemData;
  } catch (error) {
    console.error("Error adding courier note to MySQL:", error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const updateCourierNote = async (id: string, name: string): Promise<boolean> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Courier note cannot be empty.");
  }
  try {
    await initCourierNotesTable();
    const rows = await query<any[]>(`SELECT data_json FROM ${COURIER_NOTES_TABLE} WHERE id = ?`, [id]);
    if (rows.length === 0) return false;
    const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const finalData = { ...existingData, name: name.trim() };
    await query(`UPDATE ${COURIER_NOTES_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), id]);
    return true;
  } catch (error) {
    console.error("Error updating courier note in MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

export const deleteCourierNote = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await initCourierNotesTable();
    await query(`DELETE FROM ${COURIER_NOTES_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error("Error deleting courier note from MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

// --- Variation Functions ---

let isVariationsTableInitialized = false;

const initVariationsTable = async () => {
  if (isVariationsTableInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS ${VARIATIONS_TABLE} (
        id VARCHAR(255) PRIMARY KEY,
        data_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    isVariationsTableInitialized = true;
  } catch (error) {
    console.error(`Error initializing table ${VARIATIONS_TABLE}:`, error);
  }
};

const seedDefaultVariations = async (): Promise<ServiceVariationItem[]> => {
  const createdVariations: ServiceVariationItem[] = [];
  const defaultVariationsData: string[] = ["Standard", "Custom", "Premium"];

  for (const name of defaultVariationsData) {
    const id = uuidv4();
    const newVariation: ServiceVariationItem = { id, name };
    try {
      await query(`INSERT INTO ${VARIATIONS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newVariation)]);
      createdVariations.push(newVariation);
    } catch (error) {
      console.error(`Error seeding variation "${name}" in MySQL:`, error);
    }
  }
  console.log('Default service variations seeded in MySQL.');
  return createdVariations;
};

export const getVariations = async (): Promise<ServiceVariationItem[]> => {
  await guard();
  try {
    await initVariationsTable();
    const rows = await query<any[]>(`SELECT id, data_json FROM ${VARIATIONS_TABLE} ORDER BY id ASC`);
    let items = rows.map(row => ({
      id: row.id,
      ...(typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json)
    } as ServiceVariationItem));

    const laminationNamesToClean = ["Dimond Gloss - 300 GSM", "Royal Matt", "Valvate Touch"];
    const hasLaminationDefaults = items.some(item => laminationNamesToClean.includes(item.name));

    if (hasLaminationDefaults) {
      await query(`DELETE FROM ${VARIATIONS_TABLE}`);
      items = await seedDefaultVariations();
    } else if (items.length === 0) {
      console.log("No service variations found, seeding defaults in MySQL.");
      items = await seedDefaultVariations();
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error fetching variations from MySQL:", error);
    return [];
  }
};

export const addVariation = async (name: string): Promise<ServiceVariationItem | null> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Variation name cannot be empty.");
  }
  try {
    await initVariationsTable();
    const id = uuidv4();
    const newItemData: ServiceVariationItem = { id, name: name.trim() };
    await query(`INSERT INTO ${VARIATIONS_TABLE} (id, data_json) VALUES (?, ?)`, [id, JSON.stringify(newItemData)]);
    return newItemData;
  } catch (error) {
    console.error("Error adding variation to MySQL:", error);
    if (error instanceof Error) throw error;
    return null;
  }
};

export const updateVariation = async (id: string, name: string): Promise<boolean> => {
  await guard();
  if (!name.trim()) {
    throw new Error("Variation name cannot be empty.");
  }
  try {
    await initVariationsTable();
    const rows = await query<any[]>(`SELECT data_json FROM ${VARIATIONS_TABLE} WHERE id = ?`, [id]);
    if (rows.length === 0) return false;
    const existingData = typeof rows[0].data_json === 'string' ? JSON.parse(rows[0].data_json) : rows[0].data_json;
    const finalData = { ...existingData, name: name.trim() };
    await query(`UPDATE ${VARIATIONS_TABLE} SET data_json = ? WHERE id = ?`, [JSON.stringify(finalData), id]);
    return true;
  } catch (error) {
    console.error("Error updating variation in MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};

export const deleteVariation = async (id: string): Promise<boolean> => {
  await guard();
  try {
    await initVariationsTable();
    await query(`DELETE FROM ${VARIATIONS_TABLE} WHERE id = ?`, [id]);
    return true;
  } catch (error) {
    console.error("Error deleting variation from MySQL:", error);
    if (error instanceof Error) throw error;
    return false;
  }
};
