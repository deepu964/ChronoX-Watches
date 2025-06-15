/**
 * ChronoX Notifications Utility
 * Standardized SweetAlert and Toast notifications for the entire application
 */

// Toast notification function using SweetAlert2
function showToast(message, type = 'success', timer = 3000) {
    const iconMap = {
        'success': 'success',
        'error': 'error',
        'warning': 'warning',
        'info': 'info'
    };

    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: iconMap[type] || 'success',
        title: message,
        showConfirmButton: false,
        timer: timer,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });
}

// Success toast
function showSuccessToast(message, timer = 3000) {
    showToast(message, 'success', timer);
}

// Error toast
function showErrorToast(message, timer = 4000) {
    showToast(message, 'error', timer);
}

// Warning toast
function showWarningToast(message, timer = 3500) {
    showToast(message, 'warning', timer);
}

// Info toast
function showInfoToast(message, timer = 3000) {
    showToast(message, 'info', timer);
}

// Confirmation dialog
function showConfirmDialog(title, text, confirmText = 'Yes', cancelText = 'Cancel') {
    return Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: confirmText,
        cancelButtonText: cancelText
    });
}

// Delete confirmation dialog
function showDeleteConfirm(itemName = 'item') {
    return Swal.fire({
        title: 'Are you sure?',
        text: `Do you want to delete this ${itemName}? This action cannot be undone!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });
}

// Success dialog
function showSuccessDialog(title, text, confirmText = 'OK') {
    return Swal.fire({
        title: title,
        text: text,
        icon: 'success',
        confirmButtonColor: '#3085d6',
        confirmButtonText: confirmText
    });
}

// Error dialog
function showErrorDialog(title, text, confirmText = 'OK') {
    return Swal.fire({
        title: title,
        text: text,
        icon: 'error',
        confirmButtonColor: '#3085d6',
        confirmButtonText: confirmText
    });
}

// Input dialog
function showInputDialog(title, inputPlaceholder, inputType = 'text') {
    return Swal.fire({
        title: title,
        input: inputType,
        inputPlaceholder: inputPlaceholder,
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Submit',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
            if (!value) {
                return 'You need to enter something!';
            }
        }
    });
}

// Loading dialog
function showLoadingDialog(title = 'Processing...', text = 'Please wait') {
    Swal.fire({
        title: title,
        text: text,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

// Close loading dialog
function closeLoadingDialog() {
    Swal.close();
}

// Auto-close success with redirect
function showSuccessAndRedirect(message, redirectUrl, timer = 2000) {
    Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: message,
        timer: timer,
        showConfirmButton: false,
        timerProgressBar: true
    }).then(() => {
        window.location.href = redirectUrl;
    });
}

// Auto-close success with reload
function showSuccessAndReload(message, timer = 2000) {
    Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: message,
        timer: timer,
        showConfirmButton: false,
        timerProgressBar: true
    }).then(() => {
        window.location.reload();
    });
}

// Network error handler
function handleNetworkError(error) {
    console.error('Network error:', error);
    showErrorToast('Network error. Please check your connection and try again.');
}

// API response handler
function handleApiResponse(response, successMessage = 'Operation completed successfully') {
    if (response.success) {
        showSuccessToast(response.message || successMessage);
        return true;
    } else {
        showErrorToast(response.message || 'Operation failed');
        return false;
    }
}

// Form validation error display
function showValidationErrors(errors) {
    if (Array.isArray(errors)) {
        const errorList = errors.map(error => `• ${error}`).join('\n');
        showErrorDialog('Validation Errors', errorList);
    } else {
        showErrorToast(errors);
    }
}

// Session expired handler
function handleSessionExpired() {
    Swal.fire({
        title: 'Session Expired',
        text: 'Your session has expired. Please login again.',
        icon: 'warning',
        confirmButtonColor: '#3085d6',
        confirmButtonText: 'Login'
    }).then(() => {
        window.location.href = '/login';
    });
}

// Coming soon notification
function showComingSoon(feature = 'This feature') {
    Swal.fire({
        icon: 'info',
        title: 'Coming Soon!',
        text: `${feature} is coming soon!`,
        confirmButtonColor: '#3085d6'
    });
}

// Custom styled toast for specific actions
function showActionToast(message, actionText, actionCallback) {
    const toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: true,
        confirmButtonText: actionText,
        timer: 5000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    });

    toast.fire({
        icon: 'info',
        title: message
    }).then((result) => {
        if (result.isConfirmed && actionCallback) {
            actionCallback();
        }
    });
}

// Export functions for module usage (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showToast,
        showSuccessToast,
        showErrorToast,
        showWarningToast,
        showInfoToast,
        showConfirmDialog,
        showDeleteConfirm,
        showSuccessDialog,
        showErrorDialog,
        showInputDialog,
        showLoadingDialog,
        closeLoadingDialog,
        showSuccessAndRedirect,
        showSuccessAndReload,
        handleNetworkError,
        handleApiResponse,
        showValidationErrors,
        handleSessionExpired,
        showComingSoon,
        showActionToast
    };
}
