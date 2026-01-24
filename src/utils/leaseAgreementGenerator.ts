import * as fs from "fs";
import * as path from "path";
const PDFDocument = require("pdfkit");

interface LeaseAgreementData {
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  propertyAddress: string;
  propertyName: string;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  rentAmount: number;
  securityDeposit: number;
  leaseStartDate: Date;
  leaseEndDate: Date;
  paymentDate: Date;
  paymentReference: string;
}

export const generateLeaseAgreement = async (data: LeaseAgreementData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      // Read the lease agreement template
      const templatePath = path.join(__dirname, '../../../client/src/templates/lease-agreement-template.txt');
      let template = fs.readFileSync(templatePath, 'utf8');

      // Get current date components
      const now = new Date();
      const startDate = new Date(data.leaseStartDate);
      const endDate = new Date(data.leaseEndDate);

      // Replace template variables with actual data
      const replacements = {
        "{{agreement_day}}": now.getDate().toString(),
        "{{agreement_month}}": now.toLocaleString('default', { month: 'long' }),
        "{{agreement_year}}": now.getFullYear().toString(),
        "{{rc_number}}": "RC123456", // Replace with actual RC number
        "{{homematch_address}}": "123 Homematch Street, Lagos, Nigeria",
        "{{homematch_phone}}": "+234-800-HOMEMATCH",
        "{{homematch_email}}": "info@homematch.com",
        "{{tenant_name}}": data.tenantName,
        "{{tenant_address}}": data.propertyAddress, // Using property address as tenant address
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
        "{{late_fee}}": "5,000", // Default late fee amount
        "{{utilities_notes}}": "All utilities are tenant's responsibility unless otherwise specified.",
        "{{special_conditions}}": "Standard terms and conditions apply.",
        "{{homematch_representative_name}}": "HomeMatch Representative",
        "{{homematch_representative_position}}": "Property Manager",
        "{{agreement_date}}": now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      };

      // Replace all template variables
      Object.entries(replacements).forEach(([key, value]) => {
        template = template.replace(new RegExp(key, 'g'), value);
      });

      // Create PDF document
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
      });

      const chunks: Buffer[] = [];
      
      doc.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      // Add content to PDF
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .text('RESIDENTIAL LEASE AGREEMENT', { align: 'center' })
         .moveDown(2);

      // Split template into paragraphs and add to PDF
      const paragraphs = template.split('\n\n');
      
      paragraphs.forEach((paragraph) => {
        if (paragraph.trim()) {
          // Check if it's a heading (starts with numbers or contains "ARTICLE")
          if (paragraph.match(/^\d+\.|ARTICLE|LANDLORD|TENANT|PROPERTY|RENT|SECURITY DEPOSIT/)) {
            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text(paragraph.trim(), { align: 'left' })
               .moveDown(0.5);
          } else {
            doc.fontSize(10)
               .font('Helvetica')
               .text(paragraph.trim(), { align: 'justify' })
               .moveDown(0.5);
          }
        }
      });

      // Add signature section
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

      // Add footer
      doc.fontSize(8)
         .font('Helvetica')
         .text(`Generated on ${new Date().toLocaleDateString()} via Homematch Platform`, {
           align: 'center'
         });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};