# My Orders Search Troubleshooting Guide

## Issue: Search Button Not Working

### Quick Fixes to Try

#### 1. **Test Basic JavaScript**
- Click the "Test JS" button in the quick filters section
- If you see "JavaScript is working!" alert, JS is functional
- If no alert appears, there's a JavaScript loading issue

#### 2. **Use Simple Search**
- Try the green "Simple Search" button (🔄 icon) next to the main search button
- This uses page reload instead of AJAX and should work immediately
- If this works, the issue is with AJAX functionality

#### 3. **Check Browser Console**
- Press F12 to open Developer Tools
- Go to Console tab
- Look for any red error messages
- Try clicking search and see what errors appear

#### 4. **Test Search with Page Reload**
- Enter a search term in the search box
- Press Enter key (should trigger search)
- Or manually add to URL: `/my-orders?search=test`

### Common Issues and Solutions

#### **Issue 1: JavaScript Not Loading**
**Symptoms:** No alerts, no console logs, buttons don't respond
**Solutions:**
- Check if `/js/notifications.js` file exists
- Verify SweetAlert2 CDN is loading
- Check browser console for 404 errors

#### **Issue 2: AJAX Requests Failing**
**Symptoms:** Search button shows loading but no results
**Solutions:**
- Check Network tab in Developer Tools
- Look for failed requests to `/my-orders`
- Verify user is logged in (authentication required)

#### **Issue 3: Backend Not Responding**
**Symptoms:** 500 errors in console, server errors
**Solutions:**
- Check server logs for errors
- Verify MongoDB connection
- Check if `getMyOrders` controller is properly exported

#### **Issue 4: Search Parameters Not Working**
**Symptoms:** Search executes but returns all orders
**Solutions:**
- Check if search parameters are being passed correctly
- Verify backend is parsing query parameters
- Test with simple searches first

### Debugging Steps

#### **Step 1: Basic Functionality Test**
```javascript
// Open browser console and run:
console.log('Testing basic search function');
performSearch();
```

#### **Step 2: Element Verification**
```javascript
// Check if elements exist:
console.log('Search input:', document.getElementById('searchInput'));
console.log('Status filter:', document.getElementById('statusFilter'));
```

#### **Step 3: Manual AJAX Test**
```javascript
// Test AJAX call manually:
fetch('/my-orders?search=test', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
})
.then(response => response.json())
.then(data => console.log('Response:', data))
.catch(error => console.error('Error:', error));
```

#### **Step 4: Backend Test**
- Visit `/my-orders?search=test` directly in browser
- Should return HTML page with filtered results
- If this works, backend is functional

### Manual Testing URLs

#### **Test Different Search Types:**
- Order ID: `/my-orders?search=CHX123`
- Product Name: `/my-orders?search=rolex`
- Status Filter: `/my-orders?status=delivered`
- Date Range: `/my-orders?dateFrom=2024-01-01&dateTo=2024-12-31`
- Combined: `/my-orders?search=watch&status=delivered&sortBy=newest`

### Expected Behavior

#### **Successful Search:**
1. Click search button
2. Loading spinner appears
3. Results update without page reload
4. Success toast shows "Found X order(s)"
5. Pagination updates if needed

#### **Failed Search:**
1. Click search button
2. Loading spinner appears
3. Error toast shows specific error message
4. Original results remain visible

### Browser Console Debugging

#### **Enable Verbose Logging:**
The search function includes extensive console logging. Check for:
- "performSearch called with page: X"
- "Search parameters: {...}"
- "Fetching URL: /my-orders?..."
- "Response status: 200"
- "Response data: {...}"

#### **Common Console Errors:**
- `TypeError: Cannot read property 'value' of null` → Element not found
- `Failed to fetch` → Network/CORS issue
- `Unexpected token < in JSON` → Server returned HTML instead of JSON
- `401 Unauthorized` → User not logged in

### Fallback Solutions

#### **If AJAX Search Doesn't Work:**
1. Use the "Simple Search" button (green button with sync icon)
2. This performs a page reload with search parameters
3. Should work even if AJAX is broken

#### **If All Search Fails:**
1. Use manual URL parameters: `/my-orders?search=yourterm`
2. Use quick filter buttons for status filtering
3. Check if basic page loading works without search

### File Locations for Developers

#### **Frontend Files:**
- Main search interface: `views/user/myOrders.ejs`
- Search JavaScript: Lines 982-1055 in myOrders.ejs
- CSS styles: Lines 194-505 in myOrders.ejs

#### **Backend Files:**
- Search controller: `controller/user/orderController.js` (getMyOrders function)
- Route definition: `routers/userRouter.js` (line 101)

#### **Dependencies:**
- SweetAlert2: CDN loaded in head
- Font Awesome: CDN loaded in head
- Notifications.js: `/js/notifications.js` (optional)

### Testing Checklist

- [ ] Basic JavaScript alert works
- [ ] Search input accepts text
- [ ] Status filter changes values
- [ ] Simple search button works (page reload)
- [ ] AJAX search button works (no reload)
- [ ] Console shows debug messages
- [ ] Network tab shows successful requests
- [ ] Backend returns proper JSON for AJAX
- [ ] Backend returns proper HTML for page loads

### Quick Fix Implementation

If search is completely broken, add this simple working version:

```html
<!-- Add this as a temporary fix -->
<form method="GET" action="/my-orders" style="display: inline-block;">
    <input type="text" name="search" placeholder="Search orders..." style="padding: 8px;">
    <input type="hidden" name="status" value="all">
    <button type="submit" style="padding: 8px 12px;">Search</button>
</form>
```

This provides basic search functionality while debugging the main implementation.

### Contact Information

If issues persist:
1. Check server logs for backend errors
2. Verify database connectivity
3. Test with different browsers
4. Clear browser cache and cookies
5. Check if user session is valid

The search functionality should work with both AJAX (seamless) and page reload (fallback) methods.
