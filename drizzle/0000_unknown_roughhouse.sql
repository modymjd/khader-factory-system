CREATE TABLE `roles` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `name` varchar(64) NOT NULL UNIQUE,
  `description` text,
  `is_system` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `users` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `username` varchar(64) NOT NULL UNIQUE,
  `email` varchar(320),
  `password_hash` text NOT NULL,
  `role` varchar(32) NOT NULL DEFAULT 'user',
  `role_id` int,
  `is_active` boolean NOT NULL DEFAULT true,
  `last_signed_in` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `openId` varchar(64) UNIQUE,
  `name` text,
  `loginMethod` varchar(64),
  CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE `sessions` (
  `id` varchar(128) PRIMARY KEY NOT NULL,
  `user_id` int NOT NULL,
  `expires_at` timestamp NOT NULL,
  `ip_address` varchar(45),
  `user_agent` text,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE `permissions` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `name` varchar(128) NOT NULL,
  `resource` varchar(64) NOT NULL,
  `action` varchar(64) NOT NULL,
  `description` text
);

CREATE TABLE `role_permissions` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE `employees` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `user_id` int,
  `full_name` varchar(128) NOT NULL,
  `job_title` varchar(128),
  `department` varchar(128),
  `monthly_salary` decimal(12,2),
  `deductions` decimal(12,2) DEFAULT '0.00',
  `annual_leave_balance` int DEFAULT 0,
  `hire_date` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `employees_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE `products` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `sku` varchar(64) NOT NULL UNIQUE,
  `name` varchar(256) NOT NULL,
  `category` varchar(128),
  `description` text,
  `price` decimal(12,2) NOT NULL,
  `stock_quantity` int NOT NULL DEFAULT 0,
  `product_image` text,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `orders` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `order_number` varchar(64) NOT NULL UNIQUE,
  `customer_id` int,
  `total_amount` decimal(12,2) NOT NULL,
  `status` enum('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  `payment_status` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  `notes` text,
  `created_by` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `orders_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE `order_items` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `order_id` int NOT NULL,
  `product_id` int NOT NULL,
  `quantity` int NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL,
  CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE `attendance` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `employee_id` int NOT NULL,
  `date` timestamp NOT NULL,
  `check_in_time` timestamp NULL,
  `check_out_time` timestamp NULL,
  `check_in_method` varchar(32),
  `check_out_method` varchar(32),
  `notes` text,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `attendance_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE `employee_qr_codes` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `employee_id` int NOT NULL,
  `qr_code` text NOT NULL,
  `qr_code_value` varchar(256) NOT NULL UNIQUE,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `employee_qr_codes_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE `audit_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `actor` int NOT NULL,
  `action` varchar(64) NOT NULL,
  `resource` varchar(64) NOT NULL,
  `resource_id` int,
  `changes` json,
  `ip_address` varchar(45),
  `user_agent` text,
  `status` varchar(32) DEFAULT 'success',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audit_logs_actor_users_id_fk` FOREIGN KEY (`actor`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
);
