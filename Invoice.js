// ============================================================
// 📊 src/models/Invoice.js
// SUPREME Invoice Model
// ============================================================
const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
    invoiceNumber: {
        type: String,
        unique: true,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Customer details
    customer: {
        name: String,
        email: String,
        company: String,
        address: {
            line1: String,
            line2: String,
            city: String,
            state: String,
            country: String,
            zipCode: String
        },
        taxId: String, // VAT/GST number
        taxExempt: { type: Boolean, default: false }
    },
    
    // Items
    items: [{
        description: String,
        type: {
            type: String,
            enum: ['domain', 'hosting', 'ssl', 'ai', 'quantum', 'subscription', 'other']
        },
        quantity: { type: Number, default: 1 },
        unitPrice: Number,
        amount: Number,
        taxRate: Number,
        taxAmount: Number,
        metadata: mongoose.Schema.Types.Mixed
    }],
    
    // Pricing
    currency: {
        type: String,
        default: 'USD'
    },
    subtotal: Number,
    discount: {
        type: { type: String, enum: ['percentage', 'fixed', 'none'], default: 'none' },
        amount: { type: Number, default: 0 },
        description: String,
        code: String
    },
    tax: {
        totalTaxable: Number,
        totalTax: Number,
        breakdown: [{
            name: String,  // VAT, GST, Sales Tax
            rate: Number,
            amount: Number,
            country: String
        }]
    },
    total: Number,
    amountPaid: { type: Number, default: 0 },
    amountDue: Number,
    
    // Status
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'refunded'],
        default: 'draft'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending'
    },
    
    // Payment details
    payment: {
        provider: String,
        transactionId: String,
        method: String,
        paidAt: Date,
        currency: String,
        exchangeRate: Number
    },
    
    // Dates
    issueDate: { type: Date, default: Date.now },
    dueDate: Date,
    paidAt: Date,
    
    // Related
    domainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Domain' },
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    parentInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    
    // Notes
    notes: String,
    terms: String,
    
    // PDF
    pdfUrl: String,
    
    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
    tags: [String]
}, {
    timestamps: true
});

// =============================================
// 🔢 AUTO-GENERATE INVOICE NUMBER
// =============================================
InvoiceSchema.pre('save', async function(next) {
    if (this.isNew) {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        
        // Count invoices this month
        const count = await mongoose.model('Invoice').countDocuments({
            createdAt: {
                $gte: new Date(year, date.getMonth(), 1),
                $lt: new Date(year, date.getMonth() + 1, 1)
            }
        });
        
        this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

// =============================================
// 📊 INDEXES
// =============================================
InvoiceSchema.index({ userId: 1, createdAt: -1 });
InvoiceSchema.index({ invoiceNumber: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ 'payment.provider': 1, 'payment.transactionId': 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });

// =============================================
// 🔍 STATICS
// =============================================
InvoiceSchema.statics.findOverdue = function() {
    return this.find({
        dueDate: { $lt: new Date() },
        status: { $in: ['sent', 'partially_paid'] }
    });
};

InvoiceSchema.statics.getRevenueStats = async function(startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                status: 'paid',
                paidAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$currency',
                totalRevenue: { $sum: '$total' },
                totalInvoices: { $sum: 1 },
                averageInvoice: { $avg: '$total' }
            }
        }
    ]);
};

module.exports = mongoose.model('Invoice', InvoiceSchema);
