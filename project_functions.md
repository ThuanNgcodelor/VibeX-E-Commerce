# Function Descriptions

This document outlines the purpose of key functions in the Product, Review, Wallet, and Subscription management modules.

## 1. Product Management (`stock-service`)

**File:** `ProductController.java` (`/v1/stock/product`)

| Method / Endpoint | Description |
| :--- | :--- |
| `GET /public/shop/{shopId}/stats` | **Get Shop Statistics (Public)**. Returns a summary of a shop's performance: total products, average rating, response rate, total reviews, and average response time. Used for displaying shop info to customers. |
| `GET /shop-owner/stats` | **Get Shop Owner Statistics**. Returns internal stats for the authenticated shop owner: total products, banned/suspended products, and out-of-stock items. |
| `GET /public/shop/{shopId}/products` | **Get Shop Products (Public)**. Fetches a paginated list of active products for a specific shop. Visible to all users. |
| `POST /decreaseStock` | **Decrease Product Stock**. Reduces the stock quantity of a specific product size. Used when an order is placed. |
| `POST /increaseStock` | **Increase Product Stock**. Increases the stock quantity. Used when restocking or cancelling an order manually. |
| `POST /restoreStock` | **Restore Stock (Cancellation)**. Specifically restores stock when an order is cancelled, ensuring data consistency in Redis and DB. |
| `POST /create` | **Create Product**. Creates a new product with details (name, description, price, sizes) and uploads images. |
| `PUT /update` | **Update Product**. Updates an existing product's details and images. |
| `DELETE /deleteProductById/{id}` | **Delete Product**. Soft deletes or permanently removes a product (depending on implementation logic). |
| `GET /getProductById/{id}` | **Get Product Details**. Fetches full details of a single product. |
| `GET /search` | **Search Products**. Global search for products by keyword. |
| `GET /listPageShopOwner` | **List Owner's Products**. Fetches a paginated list of products belonging to the currently logged-in shop owner. |
| `POST /batch-get` | **Batch Get Products**. Internal API for fetching details of multiple products at once (optimized for Order Service). |
| `POST /batch-decrease` | **Batch Decrease Stock**. Internal API for reducing stock for multiple items in a single transaction (for checkout). |

## 2. Review Management (`stock-service`)

**File:** `ReviewController.java` (`/v1/stock/reviews`)

| Method / Endpoint | Description |
| :--- | :--- |
| `POST /` | **Create Review**. allows a user to submit a review for a product. |
| `GET /product/{productId}` | **Get Reviews by Product**. Lists all reviews associated with a specific product. |
| `GET /count/shop/{shopId}` | **Count Shop Reviews**. Returns the total number of reviews received by a shop. |
| `GET /shop/{shopId}` | **Get Reviews by Shop**. Lists all reviews for a shop (across all its products). |
| `POST /{reviewId}/reply` | **Reply to Review**. Allows a shop owner to reply to a customer's review. |
| `GET /check-today/{userId}` | **Check Daily Review Status**. Checks if a user has already submitted a review today (likely to prevent spam). |

## 3. Wallet Management

### A. User Wallet (`user-service`)
**File:** `WalletController.java` (`/v1/user/wallet`)
*Manages the personal wallet of users (buyers/sellers).*

| Method / Endpoint | Description |
| :--- | :--- |
| `GET /balance` | **Get Balance**. Returns the user's available and pending balance, along with deposit/withdrawal totals. |
| `POST /withdraw` | **Withdraw Funds**. Initiates a withdrawal request to a bank account. |
| `POST /refund` | **Add Refund**. Manually adds a refund to the wallet. |
| `GET /entries` | **Get Transaction History**. Returns a paginated list of wallet transactions (deposits, withdrawals, payments). |
| `POST /internal/payment` | **Process Payment (Internal)**. Internal API to deduct money from the wallet for a purchase. |
| `POST /deposit/direct` | **Direct Deposit**. Adds funds directly to the wallet (e.g., via VNPay). |

### B. Shop Ledger (`order-service`)
**File:** `ShopLedgerServiceImpl.java`
*Manages the business earnings of a shop owner from orders.*

| Function | Description |
| :--- | :--- |
| `processOrderEarning(Order order)` | **Process Order Earning**. Main logic. Calculates the shop's earning for a completed order, deducts commissions/fees based on their subscription, updates their ledger balance, and records the transaction. |
| `calculateCommission(...)` | **Calculate Commission**. core entry which Determines the exact fees (Platform Fee, Fixed Fee, Voucher Fee, Shipping Fee) based on the shop's active subscription plan. |
| `requestPayout(...)` | **Request Payout**. Allows the shop owner to request transferring their earnings to a bank account. |
| `deductSubscriptionFee(...)` | **Deduct Subscription Fee**. Automatically deducts the subscription renewal fee from the shop's ledger balance. |

## 4. Subscription Management (`user-service`)

**File:** `SubscriptionController.java` & `SubscriptionPlanController.java`

| Method / Endpoint | Description |
| :--- | :--- |
| `GET /shop/{shopOwnerId}` | **Get My Subscription**. Returns the current active subscription plan for a shop. |
| `POST /shop/{shopOwnerId}/subscribe` | **Subscribe**. Registers a shop for a specific subscription plan. |
| `POST /shop/{shopOwnerId}/cancel` | **Cancel Subscription**. Cancels the current subscription. |
| `POST /plans` (Admin) | **Create Plan**. Admin creates a new subscription tier (e.g., "Gold", "Silver"). |
| `PUT /plans/{id}` (Admin) | **Update Plan**. Admin updates an existing plan's features or pricing. |
| `GET /plans` | **List Plans**. Returns all available subscription plans for users to choose from. |

### B. Admin Subscription Plan Management (`user-service`)
**File:** `SubscriptionPlanController.java` (`/v1/user/subscription-plan`)
*Admin tools for managing the catalog of available subscription plans.*

| Method / Endpoint | Description |
| :--- | :--- |
| `GET /active` | **Get Active Plans**. Returns all plans currently active and available for purchase. |
| `GET /code/{code}` | **Get Plan by Code**. e.g., finding "GOLD_TIER" details. |
| `GET /` | **Get All Plans (Admin)**. Lists all plans including inactive ones. |
| `POST /` | **Create Plan**. Creates a new subscription tier. |
| `PUT /{id}` | **Update Plan**. Updates base details of a plan. |
| `PATCH /{id}/toggle` | **Toggle Active Status**. Enables or disables a plan (soft delete/hide). |
| `GET /{planId}/pricing` | **Get Plan Pricing**. Lists the pricing options (monthly, yearly) for a specific plan. |
| `POST /{planId}/pricing` | **Add Plan Pricing**. Adds a price point (e.g., "100k / month"). |
| `GET /{planId}/features` | **Get Plan Features**. Lists the benefits included in the plan (e.g., "Free Shipping", "Low Fees"). |
| `POST /{planId}/features` | **Add Plan Feature**. Adds a benefit line item to the plan. |
