// DOM Elements
const applyCouponBtn = document.getElementById("applyCouponBtn")
const couponModal = document.getElementById("couponModal")
const closeModal = document.getElementById("closeModal")
const checkCouponBtn = document.getElementById("checkCouponBtn")
const couponDetails = document.getElementById("couponDetails")
const applyCouponConfirmBtn = document.getElementById("applyCouponConfirmBtn")
const couponApplyText = document.querySelector(".coupon-apply")
const toast = document.getElementById("toast")
const toastMessage = document.querySelector(".toast-message")
const removeItemBtn = document.querySelector(".remove-item")
const placeOrderBtn = document.querySelector(".place-order-btn")
const showMoreBtn = document.querySelector(".show-more")

// Show Toast Function
function showToast(message, type = "success") {
  toastMessage.textContent = message
  toast.className = "toast"
  toast.classList.add(type)
  toast.classList.add("show")

  // Auto hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show")
  }, 3000)
}

// Open Coupon Modal
applyCouponBtn.addEventListener("click", () => {
  couponModal.classList.add("active")
  document.body.style.overflow = "hidden" // Prevent scrolling
})

// Close Coupon Modal
closeModal.addEventListener("click", () => {
  couponModal.classList.remove("active")
  document.body.style.overflow = "" // Re-enable scrolling
})

// Close Modal when clicking outside
window.addEventListener("click", (event) => {
  if (event.target === couponModal) {
    couponModal.classList.remove("active")
    document.body.style.overflow = "" // Re-enable scrolling
  }
})

// Check Coupon
checkCouponBtn.addEventListener("click", () => {
  const couponCode = document.getElementById("couponCode").value.trim()
  if (couponCode) {
    // Show coupon details (in a real app, you'd validate the coupon first)
    couponDetails.style.display = "block"
    showToast("Coupon found!", "success")
  } else {
    showToast("Please enter a coupon code", "error")
  }
})

// Apply Coupon
applyCouponConfirmBtn.addEventListener("click", () => {
  // Apply the coupon and close modal
  couponModal.classList.remove("active")
  document.body.style.overflow = "" // Re-enable scrolling

  // Update the UI to show applied coupon
  const couponRow = document.querySelector(".price-row:nth-child(3) span:last-child")
  couponRow.textContent = "-₹300"
  couponRow.className = "discount-price"
  couponApplyText.textContent = "MYNTRA300 Applied"

  // Update total amount
  const totalAmount = document.querySelector(".total-row span:last-child")
  totalAmount.textContent = "₹3210" // 3510 - 300

  showToast("Coupon applied successfully!", "success")
})

// Remove Item
removeItemBtn.addEventListener("click", () => {
  const itemCard = document.querySelector(".item-card")
  itemCard.style.opacity = "0"
  itemCard.style.height = "0"
  itemCard.style.overflow = "hidden"
  itemCard.style.padding = "0"
  itemCard.style.margin = "0"
  itemCard.style.borderTop = "none"
  itemCard.style.transition = "all 0.3s ease"

  setTimeout(() => {
    itemCard.remove()
    document.querySelector(".items-header h3").textContent = "0 ITEMS SELECTED"
    showToast("Item removed from cart", "success")
  }, 300)
})

// Place Order
placeOrderBtn.addEventListener("click", () => {
  showToast("Order placed successfully!", "success")
  setTimeout(() => {
    window.location.href = "/order-confirmation"
  }, 2000)
})

// Show More Offers
showMoreBtn.addEventListener("click", () => {
  const offerContent = document.querySelector(".offer-content p")
  const currentText = offerContent.textContent

  if (showMoreBtn.innerHTML.includes("Show More")) {
    offerContent.textContent =
      currentText +
      " Additional 5% off with HDFC Bank Credit Cards. 15% Cashback on Paytm Wallet. Buy 2 items and get 1 free on selected products."
    showMoreBtn.innerHTML = 'Show Less <i class="fas fa-chevron-up"></i>'
  } else {
    offerContent.textContent = "10% Instant Discount on Kotak Credit and Debit Cards on a min spend of Rs 3,000.TCA"
    showMoreBtn.innerHTML = 'Show More <i class="fas fa-chevron-down"></i>'
  }
})

// Coupon Apply Text Click
couponApplyText.addEventListener("click", () => {
  couponModal.classList.add("active")
  document.body.style.overflow = "hidden" // Prevent scrolling
})

// Enter key in coupon input
document.getElementById("couponCode").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault()
    checkCouponBtn.click()
  }
})

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Hide coupon details initially
  couponDetails.style.display = "none"
})
