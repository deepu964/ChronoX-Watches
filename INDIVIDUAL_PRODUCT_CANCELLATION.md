# Individual Product Cancellation Feature

## Overview
Implemented comprehensive individual product cancellation functionality that allows users to cancel specific products within an order rather than canceling the entire order. This provides greater flexibility and improved user experience.

## Features Implemented

### 1. **Database Schema Updates**

#### **Order Schema Enhancement**
**Location:** `models/orderSchema.js`

**New Fields Added to Items:**
- `status`: Individual item status (Placed, Pending, Shipped, Out for Delivery, Delivered, Cancelled)
- `cancelledAt`: Timestamp when item was cancelled
- `cancelReason`: Reason for cancellation

```javascript
items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'product' },
    quantity: Number,
    variantIndex: Number,
    price: Number,
    discount: Number,
    status: {
        type: String,
        enum: ['Placed', 'Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'],
        default: 'Placed'
    },
    cancelledAt: { type: Date },
    cancelReason: { type: String }
}]
```

### 2. **Backend Implementation**

#### **New Controller Function: `cancelOrderItem`**
**Location:** `controller/user/orderController.js`

**Functionality:**
- Validates user ownership of order
- Checks if item can be cancelled (only 'Placed' status)
- Updates item status to 'Cancelled'
- Restores product stock
- Recalculates order total
- Handles wallet refunds for online payments
- Auto-cancels order if all items are cancelled

**API Endpoint:** `PUT /cancel-order-item/:orderId/:itemId`

**Request Body:**
```javascript
{
    "reason": "Changed my mind" // Cancellation reason
}
```

**Response:**
```javascript
{
    "success": true,
    "message": "Item cancelled successfully. ₹500 has been credited to your wallet.",
    "refundAmount": 500,
    "orderStatus": "Placed"
}
```

#### **Enhanced Full Order Cancellation**
- Updated `cancelOrder` function to also cancel all individual items
- Maintains backward compatibility

### 3. **Frontend Implementation**

#### **Order Details Page Enhancement**
**Location:** `views/user/orderDetails.ejs`

**New Features:**
- Individual item status display with color-coded badges
- Cancel button for each cancellable item
- Cancelled item information (date, reason)
- Updated order total calculation excluding cancelled items
- Visual indicators for cancelled items

**Item Status Badges:**
- **Placed**: Blue badge
- **Pending**: Yellow badge  
- **Shipped**: Cyan badge
- **Delivered**: Green badge
- **Cancelled**: Red badge

#### **Interactive Cancellation Process**
1. **SweetAlert Confirmation Dialog**
   - Reason selection dropdown
   - Product name confirmation
   - Warning about action permanence

2. **Loading State**
   - Shows processing spinner
   - Prevents multiple submissions

3. **Success/Error Handling**
   - Success dialog with refund information
   - Error handling with specific messages
   - Auto-reload after successful cancellation

#### **My Orders Page Enhancement**
**Location:** `views/user/myOrders.ejs`

**New Features:**
- Partial cancellation badge for orders with some cancelled items
- Visual indicator showing number of cancelled items
- Maintains existing full order cancellation functionality

### 4. **Wallet Integration**

#### **Automatic Refunds**
- Refunds processed automatically for online payments
- Refund amount added to user wallet
- Transaction record created with details
- No refund for COD orders (as expected)

**Wallet Transaction Example:**
```javascript
{
    type: 'credit',
    amount: 500,
    description: 'Refund for cancelled item: Rolex Submariner',
    orderId: '...'
}
```

### 5. **Stock Management**

#### **Automatic Stock Restoration**
- Product stock automatically restored when item cancelled
- Handles variant-based inventory
- Prevents overselling scenarios

### 6. **Visual Design**

#### **CSS Styling**
**Enhanced Elements:**
- Cancelled item styling with opacity and red border
- Status badges with gradient backgrounds
- Cancel button with hover effects
- Responsive design for mobile devices
- Partial cancellation badges in order list

**Color Scheme:**
- **Success**: Green gradients
- **Warning**: Yellow/Orange gradients  
- **Error/Cancel**: Red gradients
- **Info**: Blue gradients

## User Experience Flow

### 1. **Individual Item Cancellation**
```
User views order details
→ Clicks "Cancel Item" button
→ Selects cancellation reason
→ Confirms cancellation
→ System processes cancellation
→ Stock restored & refund processed
→ Success message with refund details
→ Page reloads with updated status
```

### 2. **Order Status Updates**
```
Original Order: 3 items, Status: "Placed"
→ Cancel 1 item
→ Order: 2 active items, 1 cancelled, Status: "Placed"
→ Cancel all remaining items  
→ Order: 0 active items, 3 cancelled, Status: "Cancelled"
```

### 3. **Refund Process**
```
Item cancelled (Online Payment)
→ Refund amount calculated
→ Wallet balance updated
→ Transaction record created
→ User notified of refund
```

## Business Logic

### **Cancellation Rules**
1. **Only 'Placed' items can be cancelled**
2. **User must own the order**
3. **Stock is restored immediately**
4. **Refunds processed for online payments only**
5. **Order auto-cancelled if all items cancelled**

### **Total Calculation**
- Order total recalculated excluding cancelled items
- Shipping charges applied only if active items exist
- Original total shown with breakdown for transparency

### **Status Management**
- Individual item status independent of order status
- Order status reflects overall state
- Cancelled items clearly marked and separated

## Security Features

### **Authorization**
- User can only cancel their own order items
- Session-based authentication required
- Order ownership validation

### **Data Validation**
- Item existence validation
- Status transition validation
- Reason requirement for cancellation

### **Audit Trail**
- Cancellation timestamp recorded
- Cancellation reason stored
- Wallet transaction history maintained

## Error Handling

### **Common Error Scenarios**
1. **Item not found**: "Item not found in order"
2. **Already cancelled**: "Item cannot be cancelled. Current status: Delivered"
3. **Unauthorized**: "Unauthorized access"
4. **Network error**: "An error occurred while cancelling the item"

### **Graceful Degradation**
- Button state restoration on errors
- Clear error messages
- Fallback to full order cancellation if needed

## Performance Considerations

### **Database Optimization**
- Efficient queries with proper indexing
- Minimal data transfer in API responses
- Optimized population of related data

### **Frontend Optimization**
- Lazy loading of cancellation dialogs
- Efficient DOM updates
- Minimal re-renders after state changes

## Testing Scenarios

### **Test Cases**
1. **Single Item Cancellation**: Cancel one item from multi-item order
2. **All Items Cancellation**: Cancel all items individually
3. **Mixed Status Orders**: Orders with various item statuses
4. **Refund Verification**: Wallet balance updates correctly
5. **Stock Restoration**: Product quantities restored properly
6. **Error Handling**: Invalid requests handled gracefully
7. **Mobile Responsiveness**: UI works on all screen sizes

## Future Enhancements

### **Potential Improvements**
1. **Partial Quantity Cancellation**: Cancel part of item quantity
2. **Cancellation Time Limits**: Restrict cancellation after certain time
3. **Admin Override**: Allow admin to cancel any status items
4. **Bulk Cancellation**: Cancel multiple items at once
5. **Cancellation Analytics**: Track cancellation patterns
6. **Email Notifications**: Send cancellation confirmations
7. **Return Integration**: Convert cancellations to returns for shipped items

## Implementation Complete ✅

The individual product cancellation feature is fully implemented and ready for production use. Users can now cancel specific products within their orders while maintaining full order management capabilities.
