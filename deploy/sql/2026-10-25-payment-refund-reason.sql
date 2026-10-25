-- Money refunds through Razorpay are logged in the credit history with their own reason.
ALTER TYPE credit_transactions_reason_enum ADD VALUE IF NOT EXISTS 'payment_refund';
