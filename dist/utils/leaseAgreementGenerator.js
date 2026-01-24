"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLeaseAgreement = void 0;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs"));
const path = tslib_1.__importStar(require("path"));
const PDFDocument = require("pdfkit");
const generateLeaseAgreement = async (data) => {
    return new Promise((resolve, reject) => {
        try {
            const templatePath = path.join(__dirname, '../../../client/src/templates/lease-agreement-template.txt');
            let template = fs.readFileSync(templatePath, 'utf8');
            const now = new Date();
            const startDate = new Date(data.leaseStartDate);
            const endDate = new Date(data.leaseEndDate);
            const replacements = {
                "{{agreement_day}}": now.getDate().toString(),
                "{{agreement_month}}": now.toLocaleString('default', { month: 'long' }),
                "{{agreement_year}}": now.getFullYear().toString(),
                "{{rc_number}}": "RC123456",
                "{{homematch_address}}": "123 Homematch Street, Lagos, Nigeria",
                "{{homematch_phone}}": "+234-800-HOMEMATCH",
                "{{homematch_email}}": "info@homematch.com",
                "{{tenant_name}}": data.tenantName,
                "{{tenant_address}}": data.propertyAddress,
                "{{tenant_phone}}": data.tenantPhone,
                "{{tenant_email}}": data.tenantEmail,
                "{{property_address}}": data.propertyAddress,
                "{{property_description}}": data.propertyName,
                "{{start_day}}": startDate.getDate().toString(),
                "{{start_month}}": startDate.toLocaleString('default', { month: 'long' }),
                "{{start_year}}": startDate.getFullYear().toString(),
                "{{end_day}}": endDate.getDate().toString(),
                "{{end_month}}": endDate.toLocaleString('default', { month: 'long' }),
                "{{end_year}}": endDate.getFullYear().toString(),
                "{{annual_rent}}": data.rentAmount.toLocaleString(),
                "{{caution_fee}}": data.securityDeposit.toLocaleString(),
                "{{late_fee}}": "5,000",
                "{{utilities_notes}}": "All utilities are tenant's responsibility unless otherwise specified.",
                "{{special_conditions}}": "Standard terms and conditions apply.",
                "{{homematch_representative_name}}": "HomeMatch Representative",
                "{{homematch_representative_position}}": "Property Manager",
                "{{agreement_date}}": now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            };
            Object.entries(replacements).forEach(([key, value]) => {
                template = template.replace(new RegExp(key, 'g'), value);
            });
            const doc = new PDFDocument({
                margin: 50,
                size: 'A4'
            });
            const chunks = [];
            doc.on('data', (chunk) => {
                chunks.push(chunk);
            });
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                resolve(pdfBuffer);
            });
            doc.fontSize(16)
                .font('Helvetica-Bold')
                .text('RESIDENTIAL LEASE AGREEMENT', { align: 'center' })
                .moveDown(2);
            const paragraphs = template.split('\n\n');
            paragraphs.forEach((paragraph) => {
                if (paragraph.trim()) {
                    if (paragraph.match(/^\d+\.|ARTICLE|LANDLORD|TENANT|PROPERTY|RENT|SECURITY DEPOSIT/)) {
                        doc.fontSize(12)
                            .font('Helvetica-Bold')
                            .text(paragraph.trim(), { align: 'left' })
                            .moveDown(0.5);
                    }
                    else {
                        doc.fontSize(10)
                            .font('Helvetica')
                            .text(paragraph.trim(), { align: 'justify' })
                            .moveDown(0.5);
                    }
                }
            });
            doc.moveDown(2)
                .fontSize(12)
                .font('Helvetica-Bold')
                .text('SIGNATURES:', { align: 'left' })
                .moveDown(1);
            doc.fontSize(10)
                .font('Helvetica')
                .text('LANDLORD:', { continued: false })
                .moveDown(0.5)
                .text(`Name: ${data.landlordName}`)
                .text(`Email: ${data.landlordEmail}`)
                .text(`Phone: ${data.landlordPhone}`)
                .text('Signature: _________________________    Date: _____________')
                .moveDown(1);
            doc.text('TENANT:', { continued: false })
                .moveDown(0.5)
                .text(`Name: ${data.tenantName}`)
                .text(`Email: ${data.tenantEmail}`)
                .text(`Phone: ${data.tenantPhone}`)
                .text('Signature: _________________________    Date: _____________')
                .moveDown(1);
            doc.fontSize(8)
                .font('Helvetica')
                .text(`Generated on ${new Date().toLocaleDateString()} via Homematch Platform`, {
                align: 'center'
            });
            doc.end();
        }
        catch (error) {
            reject(error);
        }
    });
};
exports.generateLeaseAgreement = generateLeaseAgreement;
