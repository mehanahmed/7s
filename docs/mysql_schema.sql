-- MySQL Schema Reference for Color Hut ERP
-- This schema represents the relational equivalent of the current Firebase/API data structures.

-- 1. Identity & Access Management
CREATE TABLE user_roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#6b7280',
    is_default BOOLEAN DEFAULT FALSE,
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Note: Should be hashed in a real implementation
    role_id VARCHAR(50),
    company_name VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    category VARCHAR(100) DEFAULT NULL,
    avatar_url TEXT,
    monthly_order_target INT DEFAULT 0,
    monthly_sales_target DECIMAL(15,2) NOT NULL DEFAULT 0,
    weekly_order_target INT DEFAULT 0,
    is_banned BOOLEAN DEFAULT FALSE,
    fcm_token TEXT,
    is_leader BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES user_roles(id)
);

-- 2. CRM & Orders
CREATE TABLE order_statuses (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL,
    is_system_status BOOLEAN DEFAULT FALSE,
    is_visible BOOLEAN DEFAULT TRUE
);

CREATE TABLE clients (
    id VARCHAR(50) PRIMARY KEY, -- e.g., Job ID
    company_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY, -- e.g., ORD-20240101-001
    client_id VARCHAR(50) NOT NULL,
    crm_user_id VARCHAR(50),
    designer_representative_id VARCHAR(50),
    current_status_id VARCHAR(50),
    special_client_discount DECIMAL(10, 2) DEFAULT 0,
    shipping_charge DECIMAL(10, 2) DEFAULT 0,
    order_notes TEXT,
    packzy_consignment_id VARCHAR(100),
    packzy_tracking_code VARCHAR(100),
    is_public BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id),
    FOREIGN KEY (crm_user_id) REFERENCES users(id),
    FOREIGN KEY (designer_representative_id) REFERENCES users(id),
    FOREIGN KEY (current_status_id) REFERENCES order_statuses(id)
);

CREATE TABLE order_items (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    model VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    lamination VARCHAR(100),
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE order_payments (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(100),
    notes TEXT,
    recorded_by_user_id VARCHAR(50),
    document_url TEXT,
    status ENUM('Pending', 'Approved') DEFAULT 'Pending',
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (recorded_by_user_id) REFERENCES users(id)
);

CREATE TABLE order_status_logs (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50),
    status_id VARCHAR(50),
    changed_by_user_id VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES order_statuses(id),
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- 3. Pipeline & Leads
CREATE TABLE leads (
    id VARCHAR(50) PRIMARY KEY,
    crm_id VARCHAR(50),
    contact_name VARCHAR(255) NOT NULL,
    business_name VARCHAR(255),
    phone VARCHAR(20) NOT NULL,
    source VARCHAR(100),
    address TEXT,
    division VARCHAR(100),
    district VARCHAR(100),
    thana VARCHAR(100),
    category ENUM('POP', 'POG', 'OC', 'OD', 'ROD') DEFAULT 'POP',
    status VARCHAR(50) DEFAULT 'New Lead',
    customer_type ENUM('WARM', 'COLD', 'Order Lock'),
    notes TEXT,
    schedule TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (crm_id) REFERENCES users(id)
);

CREATE TABLE lead_activities (
    id VARCHAR(50) PRIMARY KEY,
    lead_id VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activity VARCHAR(255) NOT NULL,
    notes TEXT,
    changed_by_user_id VARCHAR(50),
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
);

-- 4. HRM & Attendance
CREATE TABLE employees (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    employee_id_display VARCHAR(20) UNIQUE, -- e.g., EMP-001
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    mobile_no VARCHAR(20) NOT NULL,
    designation VARCHAR(100),
    salary DECIMAL(10, 2) NOT NULL,
    joining_date DATE NOT NULL,
    dob DATE,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    provident_fund_status ENUM('Active', 'Inactive') DEFAULT 'Active',
    national_id VARCHAR(50),
    account_no VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5. Inventory & Finance
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    buying_price DECIMAL(10, 2) DEFAULT 0,
    selling_price DECIMAL(10, 2) DEFAULT 0,
    image_url TEXT,
    is_ready_made BOOLEAN DEFAULT FALSE,
    stock_count INT DEFAULT 0
);

CREATE TABLE finance_transactions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50),
    type ENUM('income', 'expense', 'purchase') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    document_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. Vendor Management
CREATE TABLE vendor_bills (
    id VARCHAR(50) PRIMARY KEY,
    vendor_id VARCHAR(50),
    bill_id_display VARCHAR(50),
    bill_date DATE NOT NULL,
    due_date DATE,
    subtotal DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    paid_amount DECIMAL(10, 2) DEFAULT 0,
    due_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('Paid', 'Unpaid', 'Partially Paid'),
    notes TEXT,
    FOREIGN KEY (vendor_id) REFERENCES users(id)
);

-- 7. System Settings
CREATE TABLE global_settings (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'main'
    settings_json JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
