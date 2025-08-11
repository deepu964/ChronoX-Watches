let selectedPaymentMethod = 'card';
let appliedCoupon = null;

function goToPayment() {
  window.location.href = 'payment.html';
}

function continueShopping() {
  window.location.href = 'index.html';
}

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
  const couponCode = document
    .getElementById('couponCode')
    .value.trim()
    .toUpperCase();
  const couponDetails = document.getElementById('couponDetails');

  if (!couponCode) {
    Swal.fire({
      icon: 'warning',
      title: 'Missing Coupon Code',
      text: 'Please enter a coupon code',
      confirmButtonColor: '#3085d6',
    });
    return;
  }

  const validCoupons = {
    MYNTRA300: {
      code: 'MYNTRA 300',
      discount: 301,
      minPurchase: 1499,
      expiry: '31st December 2022',
    },
    FIRST100: {
      code: 'FIRST 100',
      discount: 100,
      minPurchase: 999,
      expiry: '31st December 2022',
    },
    SAVE50: {
      code: 'SAVE 50',
      discount: 50,
      minPurchase: 499,
      expiry: '31st December 2022',
    },
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
    Swal.fire({
      icon: 'error',
      title: 'Invalid Coupon',
      text: 'Invalid coupon code. Please try again.',
      confirmButtonColor: '#3085d6',
    });
  }
}

function applyCoupon(couponCode = null) {
  if (!couponCode) {
    couponCode = document
      .getElementById('couponCode')
      .value.trim()
      .toUpperCase();
  }

  appliedCoupon = couponCode;
  closeCouponModal();

  const couponDiscountElements =
    document.querySelectorAll('.apply-coupon-link');
  couponDiscountElements.forEach((element) => {
    element.textContent = `-₹${getCouponDiscount(couponCode)}`;
    element.style.color = '#4caf50';
  });

  updateTotalAmount();

  Swal.fire({
    icon: 'success',
    title: 'Success!',
    text: 'Coupon applied successfully!',
    timer: 2000,
    showConfirmButton: false,
    toast: true,
    position: 'top-end',
  });
}

function getCouponDiscount(couponCode) {
  const discounts = {
    MYNTRA300: 301,
    FIRST100: 100,
    SAVE50: 50,
  };
  return discounts[couponCode] || 0;
}

function updateTotalAmount() {
  const baseAmount = 3510;
  const discount = appliedCoupon ? getCouponDiscount(appliedCoupon) : 0;
  const newTotal = baseAmount - discount;

  const totalElements = document.querySelectorAll(
    '.price-row.total span:last-child'
  );
  totalElements.forEach((element) => {
    element.textContent = `₹${newTotal}`;
  });
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;

  document.querySelectorAll('.payment-option').forEach((option) => {
    option.classList.remove('active');
  });

  event.target.closest('.payment-option').classList.add('active');

  const cardForm = document.getElementById('cardForm');
  if (cardForm) {
    cardForm.style.display = method === 'card' ? 'block' : 'none';
  }
}

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

  if (
    expYear < currentYear ||
    (expYear === currentYear && expMonth < currentMonth)
  ) {
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

function processPayment(event) {
  event.preventDefault();

  const cardNumber = document.getElementById('cardNumber').value;
  const cardName = document.getElementById('cardName').value;
  const expiryDate = document.getElementById('expiryDate').value;
  const cvv = document.getElementById('cvv').value;

  document.querySelectorAll('.error-message').forEach((error) => {
    error.textContent = '';
  });
  document.querySelectorAll('input').forEach((input) => {
    input.classList.remove('error');
  });

  let isValid = true;

  if (!validateCardNumber(cardNumber)) {
    document.getElementById('cardNumberError').textContent =
      'Please enter a valid card number';
    document.getElementById('cardNumber').classList.add('error');
    isValid = false;
  }

  if (!validateCardName(cardName)) {
    document.getElementById('cardNameError').textContent =
      'Please enter a valid name';
    document.getElementById('cardName').classList.add('error');
    isValid = false;
  }

  if (!validateExpiryDate(expiryDate)) {
    document.getElementById('expiryError').textContent =
      'Please enter a valid expiry date';
    document.getElementById('expiryDate').classList.add('error');
    isValid = false;
  }

  if (!validateCVV(cvv)) {
    document.getElementById('cvvError').textContent =
      'Please enter a valid CVV';
    document.getElementById('cvv').classList.add('error');
    isValid = false;
  }

  if (isValid) {
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.textContent = 'PROCESSING...';
    submitButton.disabled = true;

    setTimeout(() => {
      window.location.href = 'confirmation.html';
    }, 2000);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const cardNumberInput = document.getElementById('cardNumber');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', function () {
      formatCardNumber(this);
    });
  }

  const expiryInput = document.getElementById('expiryDate');
  if (expiryInput) {
    expiryInput.addEventListener('input', function () {
      formatExpiryDate(this);
    });
  }

  const cvvInput = document.getElementById('cvv');
  if (cvvInput) {
    cvvInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '');
    });
  }

  const modal = document.getElementById('couponModal');
  if (modal) {
    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        closeCouponModal();
      }
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeCouponModal();
    }
  });
});

// Use the standardized showToast function from notifications.js
function showNotification(message, type = 'success') {
  showToast(message, type);
}

function addToWishlist(itemId) {
  showNotification('Item added to wishlist!');
}

function removeItem(itemId) {
  Swal.fire({
    title: 'Are you sure?',
    text: 'Do you want to remove this item?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, remove it!',
  }).then((result) => {
    if (result.isConfirmed) {
      showNotification('Item removed from cart!');
      // Add your item removal logic here
    }
  });
}

function updatePrices() {
  console.log('Prices updated');
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
        });
      }
    });
  });

  document.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', function () {
      if (!this.disabled) {
        this.style.transform = 'scale(0.98)';
        setTimeout(() => {
          this.style.transform = 'scale(1)';
        }, 150);
      }
    });
  });
});
