// ============================================================
// 🧾 src/services/billing/invoice.service.js
// Invoice Generation — PDF, Email, Download
// ============================================================
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const Invoice = require('../../models/Invoice');
const taxService = require('./tax.service');

class InvoiceService {
    constructor() {
        this.invoicesDir = path.join(__dirname, '..', '..', '..', 'invoices');
        
        // Ensure invoices directory exists
        if (!fs.existsSync(this.invoicesDir)) {
            fs.mkdirSync(this.invoicesDir, { recursive: true });
        }

        // Email transporter
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    /**
     * Create invoice from domain purchase
     */
    async createDomainInvoice(userId, domainData, paymentData) {
        const { domainName, tld, years, plan, price, currency = 'USD' } = domainData;
        const { country = 'US', state, taxId, customerType } = paymentData;

        // Calculate tax
        const taxResult = state === 'US' 
            ? taxService.calculateUSTax(price, state)
            : taxService.calculateTax(price, country, customerType, false, taxId);

        // Create invoice
        const invoice = await Invoice.create({
            userId,
            customer: {
                name: domainData.customerName || 'Customer',
                email: domainData.customerEmail,
                country,
                state,
                taxId
            },
            items: [{
                description: `Domain Registration: ${domainName}.${tld}`,
                type: 'domain',
                quantity: years,
                unitPrice: price / years,
                amount: price,
                taxRate: taxResult.breakdown[0]?.rate || 0,
                taxAmount: taxResult.taxAmount
            }],
            currency,
            subtotal: price,
            tax: {
                totalTaxable: taxResult.taxableAmount,
                totalTax: taxResult.taxAmount,
                breakdown: taxResult.breakdown
            },
            total: taxResult.totalAmount,
            amountDue: taxResult.totalAmount,
            status: 'sent',
            paymentStatus: 'pending',
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            payment: {
                provider: paymentData.provider,
                transactionId: paymentData.transactionId,
                method: paymentData.method
            }
        });

        return invoice;
    }

    /**
     * Create subscription invoice
     */
    async createSubscriptionInvoice(userId, subscriptionData) {
        const { plan, price, currency, billingPeriod, customer } = subscriptionData;
        const country = customer?.country || 'US';

        const taxResult = taxService.calculateTax(price, country);

        const invoice = await Invoice.create({
            userId,
            customer,
            items: [{
                description: `SUPREME OS ${plan.toUpperCase()} Plan — ${billingPeriod}`,
                type: 'subscription',
                quantity: 1,
                unitPrice: price,
                amount: price,
                taxRate: taxResult.breakdown[0]?.rate || 0,
                taxAmount: taxResult.taxAmount
            }],
            currency,
            subtotal: price,
            tax: {
                totalTaxable: taxResult.taxableAmount,
                totalTax: taxResult.taxAmount,
                breakdown: taxResult.breakdown
            },
            total: taxResult.totalAmount,
            amountDue: taxResult.totalAmount,
            status: 'sent',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        return invoice;
    }

    /**
     * Generate PDF invoice
     */
    async generatePDF(invoiceId) {
        const invoice = await Invoice.findById(invoiceId)
            .populate('userId', 'name email');

        if (!invoice) throw new Error('Invoice not found');

        const filePath = path.join(this.invoicesDir, `${invoice.invoiceNumber}.pdf`);
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        return new Promise((resolve, reject) => {
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // Header
            doc.fontSize(24).font('Helvetica-Bold')
               .text('SUPREME OS', { align: 'right' });
            doc.fontSize(10).font('Helvetica')
               .text('supreme-os.com', { align: 'right' })
               .text('billing@supreme-os.com', { align: 'right' });

            doc.moveDown(2);

            // Invoice title
            doc.fontSize(20).font('Helvetica-Bold')
               .text('INVOICE', { align: 'left' });
            doc.fontSize(10).font('Helvetica')
               .text(`Invoice #: ${invoice.invoiceNumber}`)
               .text(`Date: ${invoice.issueDate.toLocaleDateString()}`)
               .text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`)
               .text(`Status: ${invoice.status.toUpperCase()}`);

            doc.moveDown();

            // Customer details
            doc.fontSize(12).font('Helvetica-Bold').text('Bill To:');
            doc.fontSize(10).font('Helvetica')
               .text(invoice.customer.name)
               .text(invoice.customer.email);
            if (invoice.customer.address) {
                doc.text(invoice.customer.address.line1 || '')
                   .text(`${invoice.customer.address.city || ''} ${invoice.customer.address.state || ''}`)
                   .text(invoice.customer.address.country || '');
            }
            if (invoice.customer.taxId) {
                doc.text(`Tax ID: ${invoice.customer.taxId}`);
            }

            doc.moveDown(2);

            // Items table
            this.drawTable(doc, invoice);

            doc.moveDown();

            // Totals
            const rightCol = 400;
            doc.fontSize(10).font('Helvetica');
            doc.text('Subtotal:', 300, doc.y, { width: 95, align: 'right' });
            doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, rightCol, doc.y - 12);

            if (invoice.discount.amount > 0) {
                doc.text('Discount:', 300, doc.y, { width: 95, align: 'right' });
                doc.text(`-${invoice.currency} ${invoice.discount.amount.toFixed(2)}`, rightCol, doc.y - 12);
            }

            doc.text('Tax:', 300, doc.y, { width: 95, align: 'right' });
            doc.text(`${invoice.currency} ${invoice.tax.totalTax.toFixed(2)}`, rightCol, doc.y - 12);

            doc.moveDown(0.5);
            doc.fontSize(14).font('Helvetica-Bold');
            doc.text('TOTAL:', 300, doc.y, { width: 95, align: 'right' });
            doc.text(`${invoice.currency} ${invoice.total.toFixed(2)}`, rightCol, doc.y - 16);

            // Tax breakdown
            doc.moveDown(1);
            doc.fontSize(8).font('Helvetica');
            for (const tax of invoice.tax.breakdown) {
                doc.text(`${tax.name} (${tax.rate}%): ${invoice.currency} ${tax.amount.toFixed(2)}`);
            }

            // Footer
            doc.moveDown(3);
            doc.fontSize(8).font('Helvetica')
               .text('Thank you for choosing SUPREME OS!', { align: 'center' })
               .text('Terms: Payment due within 30 days.', { align: 'center' });

            doc.end();

            stream.on('finish', () => {
                invoice.pdfUrl = filePath;
                invoice.save();
                resolve(filePath);
            });

            stream.on('error', reject);
        });
    }

    /**
     * Draw items table
     */
    drawTable(doc, invoice) {
        const tableTop = doc.y;
        const colWidths = [40, 240, 60, 70, 90];
        const headers = ['Qty', 'Description', 'Rate', 'Tax', 'Amount'];

        // Headers
        doc.fontSize(9).font('Helvetica-Bold');
        let x = 50;
        headers.forEach((header, i) => {
            doc.text(header, x, tableTop, { width: colWidths[i], align: i >= 2 ? 'right' : 'left' });
            x += colWidths[i];
        });

        // Line
        doc.moveDown(0.3);
        const lineY = doc.y;
        doc.moveTo(50, lineY).lineTo(550, lineY).stroke();

        // Items
        doc.fontSize(9).font('Helvetica');
        let itemY = lineY + 5;

        for (const item of invoice.items) {
            x = 50;
            const texts = [
                String(item.quantity),
                item.description,
                `${invoice.currency} ${item.unitPrice.toFixed(2)}`,
                `${item.taxRate}%`,
                `${invoice.currency} ${item.amount.toFixed(2)}`
            ];

            texts.forEach((text, i) => {
                doc.text(text, x, itemY, { width: colWidths[i], align: i >= 2 ? 'right' : 'left' });
                x += colWidths[i];
            });

            itemY += 20;
        }

        doc.moveDown(1);
    }

    /**
     * Send invoice via email
     */
    async sendInvoice(invoiceId) {
        const invoice = await Invoice.findById(invoiceId);
        
        if (!invoice) throw new Error('Invoice not found');

        const pdfPath = await this.generatePDF(invoiceId);

        await this.transporter.sendMail({
            from: '"SUPREME OS Billing" <billing@supreme-os.com>',
            to: invoice.customer.email,
            subject: `Invoice ${invoice.invoiceNumber} from SUPREME OS`,
            html: `
                <h2>Invoice ${invoice.invoiceNumber}</h2>
                <p>Dear ${invoice.customer.name},</p>
                <p>Your invoice for <strong>${invoice.currency} ${invoice.total.toFixed(2)}</strong> is attached.</p>
                <p>Due date: ${invoice.dueDate.toLocaleDateString()}</p>
                <p>View online: <a href="${process.env.FRONTEND_URL}/billing/invoices/${invoice._id}">View Invoice</a></p>
                <br>
                <p>Thank you for your business!</p>
                <p>SUPREME OS Billing Team</p>
            `,
            attachments: [{
                filename: `${invoice.invoiceNumber}.pdf`,
                path: pdfPath
            }]
        });

        invoice.status = 'sent';
        await invoice.save();

        return { sent: true, invoice };
    }

    /**
     * Get revenue report
     */
    async getRevenueReport(startDate, endDate) {
        const stats = await Invoice.getRevenueStats(startDate, endDate);
        
        // Get total by currency
        const totals = {};
        for (const stat of stats) {
            totals[stat._id] = {
                revenue: stat.totalRevenue,
                invoices: stat.totalInvoices,
                average: stat.averageInvoice
            };
        }

        // Get monthly breakdown
        const monthlyBreakdown = await Invoice.aggregate([
            {
                $match: {
                    status: 'paid',
                    paidAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$paidAt' },
                        month: { $month: '$paidAt' }
                    },
                    revenue: { $sum: '$total' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        return {
            period: { startDate, endDate },
            totals,
            monthlyBreakdown,
            totalRevenue: Object.values(totals).reduce((sum, t) => sum + t.revenue, 0),
            totalInvoices: Object.values(totals).reduce((sum, t) => sum + t.invoices, 0)
        };
    }
}

module.exports = new InvoiceService();
