const express = require('express');
const { currentUser, nats, publishEvent, OrderStatus, OrderDeletedSchema, NotFoundError, NotAuthorizedError } = require('@sbticketsproject/shared');
const Ticket = require('../db-models/ticket');
const Order = require('../db-models/order');

const router = express.Router();

router.delete('/api/orders/:orderId', async(req, res) => {
    const { orderId } = req.params;

    //find the order
    const order = await Order.findById(orderId).populate('ticket');
    const previousOrder = await Order.findById(orderId).populate('ticket');
    if (!order) throw new NotFoundError();

    const token = req.cookies['jwt'];
    const user = currentUser(token, process.env.JWT_KEY);
    if (order.userId !== user.id) throw new NotAuthorizedError();

    //update order status
    order.set({
        status: OrderStatus.Cancelled
    });
    await order.save();

    // publishing an event saying this was cancelled!
    const stan = nats.client();
    await publishEvent(stan, OrderDeletedSchema.channel, OrderDeletedSchema.create({
        orderId: order._id,
        ticketId: order.ticket._id,
        version: order.version,
        previousVersion: previousOrder.version
    }));

    res.send({ message: "order deleted succefully!!" });
});

module.exports = router;