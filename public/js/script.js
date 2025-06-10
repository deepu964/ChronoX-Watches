// Global variables
let selectedPaymentMethod = 'card';
let appliedCoupon = null;

// Navigation functions
function goToPayment() {
    window.location.href = 'payment.html';
}

function continueShopping() {
    window.location.href = 'index.html';
}

// Coupon modal functions
function openCouponModal() {
    document.getElementById('couponModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeCouponModal() {
    document.getElementById('couponModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('couponCode').value = '';
    document.getElementById('couponDetails').style.display = 'none';
}

function checkCoupon() {
    const couponCode = document.getElementById('couponCode').value.trim().toUpperCase();
    const couponDetails = document.getElementById('couponDetails');
    
    if (!couponCode) {
        alert('Please enter a coupon code');
        return;
    }
    
    // Simulate coupon validation
    const validCoupons = {
        'MYNTRA300': {
            code: 'MYNTRA 300',
            discount: 301,
            minPurchase: 1499,
            expiry: '31st December 2022'
        },
        'FIRST100': {
            code: 'FIRST 100',
            discount: 100,
            minPurchase: 999,
            expiry: '31st December 2022'
        },
        'SAVE50': {
            code: 'SAVE 50',
            discount: 50,
            minPurchase: 499,
            expiry: '31st December 2022'
        }
    };
    
    if (validCoupons[couponCode]) {
        const coupon = validCoupons[couponCode];
        couponDetails.innerHTML = `
            <div class="coupon-card">
                <div class="coupon-code">${coupon.code}</div>
                <div class="coupon-info">
                    <p><strong>Save ₹${coupon.discount}</strong></p>
                    <p>Rs.${coupon.discount} off on minimum purchase of Rs.${coupon.minPurchase}</p>
                    <p>Expires on: ${coupon.expiry}</p>
                    <div class="savings">
                        <span>Maximum savings:</span>
                        <span>₹${coupon.discount}</span>
                    </div>
                </div>
            </div>
            <button class="apply-coupon-btn" onclick="applyCoupon('${couponCode}')">APPLY</button>
        `;
        couponDetails.style.display = 'block';
    } else {
        alert('Invalid coupon code. Please try again.');
    }
}

function applyCoupon(couponCode = null) {
    if (!couponCode) {
        couponCode = document.getElementById('couponCode').value.trim().toUpperCase();
    }
    
    appliedCoupon = couponCode;
    closeCouponModal();
    
    // Update UI to show applied coupon
    const couponDiscountElements = document.querySelectorAll('.apply-coupon-link');
    couponDiscountElements.forEach(element => {
        element.textContent = `-₹${getCouponDiscount(couponCode)}`;
        element.style.color = '#4caf50';
    });
    
    // Update total amount
    updateTotalAmount();
    
    alert('Coupon applied successfully!');
}

function getCouponDiscount(couponCode) {
    const discounts = {
        'MYNTRA300': 301,
        'FIRST100': 100,
        'SAVE50': 50
    };
    return discounts[couponCode] || 0;
}

function updateTotalAmount() {
    const baseAmount = 3510;
    const discount = appliedCoupon ? getCouponDiscount(appliedCoupon) : 0;
    const newTotal = baseAmount - discount;
    
    const totalElements = document.querySelectorAll('.price-row.total span:last-child');
    totalElements.forEach(element => {
        element.textContent = `₹${newTotal}`;
    });
}

// Payment method selection
function selectPaymentMethod(method) {
    selectedPaymentMethod = method;
    
    // Update active state
    document.querySelectorAll('.payment-option').forEach(option => {
        option.classList.remove('active');
    });
    
    event.target.closest('.payment-option').classList.add('active');
    
    // Show/hide card form
    const cardForm = document.getElementById('cardForm');
    if (cardForm) {
        cardForm.style.display = method === 'card' ? 'block' : 'none';
    }
}

// Form validation functions
function validateCardNumber(cardNumber) {
    const cleaned = cardNumber.replace(/\s/g, '');
    return /^\d{13,19}$/.test(cleaned);
}

function validateExpiryDate(expiry) {
    const regex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!regex.test(expiry)) return false;
    
    const [month, year] = expiry.split('/');
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;
    
    const expYear = parseInt(year);
    const expMonth = parseInt(month);
    
    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
        return false;
    }
    
    return true;
}

function validateCVV(cvv) {
    return /^\d{3,4}$/.test(cvv);
}

function validateCardName(name) {
    return /^[a-zA-Z\s]{2,}$/.test(name.trim());
}

// Input formatting
function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '');
    let formattedValue = value.replace(/(.{4})/g, '$1 ');
    if (formattedValue.endsWith(' ')) {
        formattedValue = formattedValue.slice(0, -1);
    }
    input.value = formattedValue;
}

function formatExpiryDate(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    input.value = value;
}

// Payment processing
function processPayment(event) {
    event.preventDefault();
    
    const cardNumber = document.getElementById('cardNumber').value;
    const cardName = document.getElementById('cardName').value;
    const expiryDate = document.getElementById('expiryDate').value;
    const cvv = document.getElementById('cvv').value;
    
    // Clear previous errors
    document.querySelectorAll('.error-message').forEach(error => {
        error.textContent = '';
    });
    document.querySelectorAll('input').forEach(input => {
        input.classList.remove('error');
    });
    
    let isValid = true;
    
    // Validate card number
    if (!validateCardNumber(cardNumber)) {
        document.getElementById('cardNumberError').textContent = 'Please enter a valid card number';
        document.getElementById('cardNumber').classList.add('error');
        isValid = false;
    }
    
    // Validate card name
    if (!validateCardName(cardName)) {
        document.getElementById('cardNameError').textContent = 'Please enter a valid name';
        document.getElementById('cardName').classList.add('error');
        isValid = false;
    }
    
    // Validate expiry date
    if (!validateExpiryDate(expiryDate)) {
        document.getElementById('expiryError').textContent = 'Please enter a valid expiry date';
        document.getElementById('expiryDate').classList.add('error');
        isValid = false;
    }
    
    // Validate CVV
    if (!validateCVV(cvv)) {
        document.getElementById('cvvError').textContent = 'Please enter a valid CVV';
        document.getElementById('cvv').classList.add('error');
        isValid = false;
    }
    
    if (isValid) {
        // Simulate payment processing
        const submitButton = event.target.querySelector('button[type="submit"]');
        submitButton.textContent = 'PROCESSING...';
        submitButton.disabled = true;
        
        setTimeout(() => {
            window.location.href = 'confirmation.html';
        }, 2000);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Card number formatting
    const cardNumberInput = document.getElementById('cardNumber');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function() {
            formatCardNumber(this);
        });
    }
    
    // Expiry date formatting
    const expiryInput = document.getElementById('expiryDate');
    if (expiryInput) {
        expiryInput.addEventListener('input', function() {
            formatExpiryDate(this);
        });
    }
    
    // CVV input restriction
    const cvvInput = document.getElementById('cvv');
    if (cvvInput) {
        cvvInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '');
        });
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('couponModal');
    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeCouponModal();
            }
        });
    }
    
    // Keyboard navigation for modal
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeCouponModal();
        }
    });
});

// Utility functions
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = notification `${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background:${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        border-radius: 6px;
        z-index: 1001;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Add some interactive features
function addToWishlist(itemId) {
    showNotification('Item added to wishlist!');
}

function removeItem(itemId) {
    if (confirm('Are you sure you want to remove this item?')) {
        showNotification('Item removed from cart!');
        // Here you would typically update the cart
    }
}

// Simulate real-time price updates
function updatePrices() {
    // This could be connected to a real API
    console.log('Prices updated');
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add loading states to buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', function() {
            if (!this.disabled) {
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = 'scale(1)';
                }, 150);
            }
        });
    });
});