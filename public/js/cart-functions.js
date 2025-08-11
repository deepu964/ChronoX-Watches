const applyCouponBtn = document.getElementById('applyCouponBtn');
const couponModal = document.getElementById('couponModal');
const closeModal = document.getElementById('closeModal');
const checkCouponBtn = document.getElementById('checkCouponBtn');
const couponDetails = document.getElementById('couponDetails');
const applyCouponConfirmBtn = document.getElementById('applyCouponConfirmBtn');
const couponApplyText = document.querySelector('.coupon-apply');
const toast = document.getElementById('toast');
const toastMessage = document.querySelector('.toast-message');
const removeItemBtn = document.querySelector('.remove-item');
const placeOrderBtn = document.querySelector('.place-order-btn');
const showMoreBtn = document.querySelector('.show-more');

// Use the standardized showToast function from notifications.js
// This function is now available globally

applyCouponBtn.addEventListener('click', () => {
  couponModal.classList.add('active');
  document.body.style.overflow = 'hidden';
});

closeModal.addEventListener('click', () => {
  couponModal.classList.remove('active');
  document.body.style.overflow = '';
});

window.addEventListener('click', (event) => {
  if (event.target === couponModal) {
    couponModal.classList.remove('active');
    document.body.style.overflow = '';
  }
});

checkCouponBtn.addEventListener('click', () => {
  const couponCode = document.getElementById('couponCode').value.trim();
  if (couponCode) {
    couponDetails.style.display = 'block';
    showToast('Coupon found!', 'success');
  } else {
    showToast('Please enter a coupon code', 'error');
  }
});

applyCouponConfirmBtn.addEventListener('click', () => {
  couponModal.classList.remove('active');
  document.body.style.overflow = '';

  const couponRow = document.querySelector(
    '.price-row:nth-child(3) span:last-child'
  );
  couponRow.textContent = '-₹300';
  couponRow.className = 'discount-price';
  couponApplyText.textContent = 'MYNTRA300 Applied';

  const totalAmount = document.querySelector('.total-row span:last-child');
  totalAmount.textContent = '₹3210';

  showToast('Coupon applied successfully!', 'success');
});

removeItemBtn.addEventListener('click', () => {
  const itemCard = document.querySelector('.item-card');
  itemCard.style.opacity = '0';
  itemCard.style.height = '0';
  itemCard.style.overflow = 'hidden';
  itemCard.style.padding = '0';
  itemCard.style.margin = '0';
  itemCard.style.borderTop = 'none';
  itemCard.style.transition = 'all 0.3s ease';

  setTimeout(() => {
    itemCard.remove();
    document.querySelector('.items-header h3').textContent = '0 ITEMS SELECTED';
    showToast('Item removed from cart', 'success');
  }, 300);
});

placeOrderBtn.addEventListener('click', () => {
  showToast('Order placed successfully!', 'success');
  setTimeout(() => {
    window.location.href = '/order-confirmation';
  }, 2000);
});

showMoreBtn.addEventListener('click', () => {
  const offerContent = document.querySelector('.offer-content p');
  const currentText = offerContent.textContent;

  if (showMoreBtn.innerHTML.includes('Show More')) {
    offerContent.textContent =
      currentText +
      ' Additional 5% off with HDFC Bank Credit Cards. 15% Cashback on Paytm Wallet. Buy 2 items and get 1 free on selected products.';
    showMoreBtn.innerHTML = 'Show Less <i class="fas fa-chevron-up"></i>';
  } else {
    offerContent.textContent =
      '10% Instant Discount on Kotak Credit and Debit Cards on a min spend of Rs 3,000.TCA';
    showMoreBtn.innerHTML = 'Show More <i class="fas fa-chevron-down"></i>';
  }
});

couponApplyText.addEventListener('click', () => {
  couponModal.classList.add('active');
  document.body.style.overflow = 'hidden';
});

document.getElementById('couponCode').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    checkCouponBtn.click();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  couponDetails.style.display = 'none';
});
