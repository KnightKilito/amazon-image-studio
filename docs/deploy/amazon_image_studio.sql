/*
 Navicat Premium Dump SQL

 Source Server         : MySQL-local
 Source Server Type    : MySQL
 Source Server Version : 80045 (8.0.45)
 Source Host           : localhost:3306
 Source Schema         : amazon_image_studio

 Target Server Type    : MySQL
 Target Server Version : 80045 (8.0.45)
 File Encoding         : 65001

 Date: 07/07/2026 15:43:55
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for admin_settings
-- ----------------------------
DROP TABLE IF EXISTS `admin_settings`;
CREATE TABLE `admin_settings`  (
  `setting_key` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` json NOT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of admin_settings
-- ----------------------------
INSERT INTO `admin_settings` VALUES ('admin_access', '{\"modelIds\": [\"gpt-image-2\", \"gpt-5.5\", \"gpt-5.4\", \"gpt-5.4-mini\"], \"allowGuestEditApiUrl\": true, \"allowGuestViewApiUrl\": true, \"unifiedGuestImageApiUrl\": \"https://sadai.cc/v1\", \"allowGuestEditApiProvider\": true, \"referenceImageUploadLimit\": 7, \"unifiedGuestPlannerApiUrl\": \"https://www.packyapi.com/v1\", \"allowGuestCreateApiProfile\": true, \"allowGuestCreateCustomProvider\": true, \"unifiedGuestImageApiUrlEnabled\": false, \"unifiedGuestPlannerApiUrlEnabled\": false}', '2026-07-07 15:41:37');

-- ----------------------------
-- Table structure for admin_users
-- ----------------------------
DROP TABLE IF EXISTS `admin_users`;
CREATE TABLE `admin_users`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_sha256` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `username`(`username` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of admin_users
-- ----------------------------
INSERT INTO `admin_users` VALUES (1, 'admin', '757c484a1e18c9f3724235680fba5790cbe59530f65a0d1360bc054c28da682c', '2026-06-25 22:01:38', '2026-06-25 22:01:38');

SET FOREIGN_KEY_CHECKS = 1;
