const Order = require('../../models/orderSchema');


const generateInvoice = async (req,res,next) => {
    try {
        
         const orderId = req.params.orderId;

    const order = await Order.findById(orderId)
    .populate('user')
    .populate('items.product');
    console.log(order,'is order')

    if (!order) {
      return res.status(404).send('Order not found');
    }
   
    return res.render('user/invoice',{order})

    } catch (error) {
        console.log("this is invoice error");
        next(error);
    }
    
}

module.exports ={
    generateInvoice,

}