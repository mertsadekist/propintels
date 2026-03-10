-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_status_idx`(`status`),
    INDEX `User_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserRole_roleId_idx`(`roleId`),
    INDEX `UserRole_userId_idx`(`userId`),
    UNIQUE INDEX `UserRole_userId_roleId_key`(`userId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `category` ENUM('RESIDENTIAL', 'COMMERCIAL') NOT NULL DEFAULT 'RESIDENTIAL',
    `defaultType` ENUM('APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'DUPLEX', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND', 'OTHER') NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `ownerId` VARCHAR(191) NOT NULL,
    `areaTolerancePct` INTEGER NULL,
    `currency` VARCHAR(191) NULL DEFAULT 'AED',
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Project_ownerId_idx`(`ownerId`),
    INDEX `Project_isActive_idx`(`isActive`),
    INDEX `Project_location_idx`(`location`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Entry` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('LISTING', 'TRANSACTION') NOT NULL,
    `category` ENUM('RESIDENTIAL', 'COMMERCIAL') NOT NULL DEFAULT 'RESIDENTIAL',
    `propertyType` ENUM('APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'DUPLEX', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND', 'OTHER') NOT NULL,
    `bedrooms` INTEGER NULL,
    `bathrooms` INTEGER NULL,
    `unitType` VARCHAR(191) NULL,
    `portal` VARCHAR(191) NULL,
    `locationLabel` VARCHAR(191) NULL,
    `createdDate` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `areaSqft` DECIMAL(12, 2) NULL,
    `askPrice` DECIMAL(18, 2) NULL,
    `lowestPrice` DECIMAL(18, 2) NULL,
    `transactionDate` DATETIME(3) NULL,
    `transactionAreaSqft` DECIMAL(12, 2) NULL,
    `transactionPrice` DECIMAL(18, 2) NULL,
    `askPsf` DECIMAL(18, 6) NULL,
    `lowPsf` DECIMAL(18, 6) NULL,
    `transactionPsf` DECIMAL(18, 6) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Entry_projectId_propertyType_bedrooms_idx`(`projectId`, `propertyType`, `bedrooms`),
    INDEX `Entry_projectId_sourceType_idx`(`projectId`, `sourceType`),
    INDEX `Entry_isActive_idx`(`isActive`),
    INDEX `Entry_transactionDate_idx`(`transactionDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValuationLink` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `agentId` VARCHAR(191) NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'DISABLED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `expiresAt` DATETIME(3) NULL,
    `maxUses` INTEGER NULL,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ValuationLink_tokenHash_key`(`tokenHash`),
    INDEX `ValuationLink_projectId_status_idx`(`projectId`, `status`),
    INDEX `ValuationLink_agentId_idx`(`agentId`),
    INDEX `ValuationLink_expiresAt_idx`(`expiresAt`),
    INDEX `ValuationLink_tokenHash_idx`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `assignedAgentId` VARCHAR(191) NULL,
    `status` ENUM('NEW', 'CONTACTED', 'QUALIFIED', 'APPOINTMENT_SET', 'WON', 'LOST', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `category` ENUM('RESIDENTIAL', 'COMMERCIAL') NOT NULL DEFAULT 'RESIDENTIAL',
    `propertyType` ENUM('APARTMENT', 'VILLA', 'TOWNHOUSE', 'PENTHOUSE', 'DUPLEX', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'LAND', 'OTHER') NOT NULL,
    `bedrooms` INTEGER NULL,
    `bathrooms` INTEGER NULL,
    `unitType` VARCHAR(191) NULL,
    `areaSqft` DECIMAL(12, 2) NOT NULL,
    `clientPrice` DECIMAL(18, 2) NOT NULL,
    `currency` VARCHAR(191) NULL DEFAULT 'AED',
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Lead_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `Lead_assignedAgentId_status_idx`(`assignedAgentId`, `status`),
    INDEX `Lead_status_idx`(`status`),
    INDEX `Lead_linkId_idx`(`linkId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValuationResult` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `rulesVersion` INTEGER NOT NULL DEFAULT 1,
    `areaTolerancePct` INTEGER NULL,
    `outlierMethod` VARCHAR(191) NULL,
    `minComps` INTEGER NULL,
    `benchmark` VARCHAR(191) NULL,
    `clientPsf` DECIMAL(18, 6) NOT NULL,
    `listingCount` INTEGER NULL,
    `listingMeanPsf` DECIMAL(18, 6) NULL,
    `listingMedianPsf` DECIMAL(18, 6) NULL,
    `listingMinPsf` DECIMAL(18, 6) NULL,
    `listingMaxPsf` DECIMAL(18, 6) NULL,
    `transactionCount` INTEGER NULL,
    `transactionMeanPsf` DECIMAL(18, 6) NULL,
    `transactionMedianPsf` DECIMAL(18, 6) NULL,
    `transactionMinPsf` DECIMAL(18, 6) NULL,
    `transactionMaxPsf` DECIMAL(18, 6) NULL,
    `recommendedLow` DECIMAL(18, 2) NULL,
    `recommendedMid` DECIMAL(18, 2) NULL,
    `recommendedHigh` DECIMAL(18, 2) NULL,
    `verdict` ENUM('BELOW_MARKET', 'ALIGNED', 'SLIGHTLY_ABOVE', 'ABOVE_MARKET', 'INSUFFICIENT_DATA') NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    `ratioToMarket` DECIMAL(18, 6) NULL,
    `confidence` INTEGER NOT NULL DEFAULT 0,
    `explanations` JSON NULL,
    `compsUsed` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ValuationResult_leadId_key`(`leadId`),
    INDEX `ValuationResult_verdict_idx`(`verdict`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `status` ENUM('QUEUED', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `storageKey` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NOT NULL DEFAULT 'application/pdf',
    `fileSize` INTEGER NULL,
    `checksumSha256` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Report_leadId_idx`(`leadId`),
    INDEX `Report_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Setting_key_idx`(`key`),
    INDEX `Setting_projectId_idx`(`projectId`),
    UNIQUE INDEX `Setting_scope_projectId_key_key`(`scope`, `projectId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_action_idx`(`action`),
    INDEX `AuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Project` ADD CONSTRAINT `Project_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Entry` ADD CONSTRAINT `Entry_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValuationLink` ADD CONSTRAINT `ValuationLink_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValuationLink` ADD CONSTRAINT `ValuationLink_agentId_fkey` FOREIGN KEY (`agentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_linkId_fkey` FOREIGN KEY (`linkId`) REFERENCES `ValuationLink`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_assignedAgentId_fkey` FOREIGN KEY (`assignedAgentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValuationResult` ADD CONSTRAINT `ValuationResult_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
