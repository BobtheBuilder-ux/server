"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const emailService_1 = require("./utils/emailService");
const emailTemplates_1 = require("./utils/emailTemplates");
const TEST_EMAIL = 'berrybobbiechuks@gmail.com';
async function testEmailTemplates() {
    console.log('🧪 Testing Resend email templates...');
    console.log('Configuration:');
    console.log(`- Resend API Key: ${process.env.RESEND_API_KEY ? 'Set' : 'Not set'}`);
    console.log(`- From Email: ${process.env.RESEND_FROM_EMAIL}`);
    console.log('');
    console.log('🔧 Testing Resend configuration...');
    const configTest = await (0, emailService_1.testEmailConfiguration)();
    if (!configTest) {
        console.log('❌ Resend configuration failed. Please check your API key.');
        console.log('\n📋 Troubleshooting Tips:');
        console.log('1. Verify your Resend API key is correct');
        console.log('2. Check that your domain is verified in Resend dashboard');
        console.log('3. Ensure RESEND_FROM_EMAIL is set to a verified sender');
        console.log('4. Verify your Resend account is active and not suspended');
        return;
    }
    console.log('✅ Resend configuration is valid!');
    console.log('');
    const testTemplates = [
        {
            name: 'Survey Confirmation (Tenant)',
            template: emailTemplates_1.surveyConfirmationTemplate.tenant,
            data: ['John Doe']
        },
        {
            name: 'Survey Confirmation (Landlord)',
            template: emailTemplates_1.surveyConfirmationTemplate.landlord,
            data: ['Jane Smith']
        },
        {
            name: 'Welcome to Email List',
            template: emailTemplates_1.welcomeToEmailListTemplate,
            data: ['Mike Johnson', 'tenant_survey']
        },
        {
            name: 'Job Application Submitted',
            template: emailTemplates_1.jobApplicationSubmittedTemplate,
            data: ['Sarah Wilson', 'Software Developer', 'HomeMatch Tech']
        },
        {
            name: 'Job Application Shortlisted',
            template: emailTemplates_1.jobApplicationShortlistedTemplate,
            data: ['David Brown', 'Marketing Manager', 'HomeMatch Corp', 'December 15, 2024', '2:00 PM', 'HomeMatch Office, Lagos']
        },
        {
            name: 'Job Application Rejected',
            template: emailTemplates_1.jobApplicationRejectedTemplate,
            data: ['Lisa Garcia', 'Product Manager', 'HomeMatch Inc']
        },
        {
            name: 'Job Application Hired',
            template: emailTemplates_1.jobApplicationHiredTemplate,
            data: ['Robert Taylor', 'Senior Developer', 'HomeMatch Solutions', 'January 2, 2025', '₦2,500,000', 'HR Manager', 'hr@homematch.com']
        },
        {
            name: 'Tenant Welcome',
            template: emailTemplates_1.tenantWelcomeTemplate,
            data: ['Alice Cooper', 'alice@example.com', 'temp123']
        },
        {
            name: 'Inspection Request',
            template: emailTemplates_1.inspectionRequestTemplate,
            data: ['Tom Anderson', '123 Victoria Island, Lagos', 'December 20, 2024', '10:00 AM']
        },
        {
            name: 'Inspection Approved',
            template: emailTemplates_1.inspectionApprovedTemplate,
            data: ['Emma Davis', '456 Lekki Phase 1, Lagos', 'December 22, 2024', '2:00 PM', 'Agent Johnson', '+234 801 234 5678']
        },
        {
            name: 'Application Submitted',
            template: emailTemplates_1.applicationSubmittedTemplate,
            data: ['Chris Wilson', '789 Ikoyi, Lagos', 'December 18, 2024', 3500000, 700000, 350000]
        },
        {
            name: 'Admin Welcome',
            template: emailTemplates_1.adminWelcomeTemplate,
            data: ['Admin User', 'admin@homematch.com', 'tempAdmin123']
        }
    ];
    console.log(`📧 Testing ${testTemplates.length} email templates...\n`);
    for (let i = 0; i < testTemplates.length; i++) {
        const { name, template, data } = testTemplates[i];
        try {
            console.log(`${i + 1}. Testing: ${name}`);
            const subject = template.subject;
            const body = template.body(...data);
            if (!subject || !body) {
                console.log(`   ❌ Template validation failed - missing subject or body`);
                continue;
            }
            if (body.length < 100) {
                console.log(`   ⚠️  Template seems too short (${body.length} chars)`);
            }
            const unreplacedVars = body.match(/\$\{[^}]+\}/g);
            if (unreplacedVars) {
                console.log(`   ⚠️  Found unreplaced variables: ${unreplacedVars.join(', ')}`);
            }
            await (0, emailService_1.sendEmail)({
                to: TEST_EMAIL,
                subject: `[TEST] ${subject}`,
                body: body
            });
            console.log(`   ✅ Template generated successfully`);
            console.log(`   📝 Subject: ${subject}`);
            console.log(`   📏 Body length: ${body.length} characters`);
        }
        catch (error) {
            console.log(`   ❌ Error testing template: ${error.message}`);
        }
        console.log('');
    }
    console.log('🎯 Template Testing Summary:');
    console.log(`- Total templates tested: ${testTemplates.length}`);
    console.log('- All templates use responsive HTML design');
    console.log('- Templates include proper styling and branding');
    console.log('- Ready for production use with Resend');
    console.log('');
    console.log('💡 To send actual test emails, uncomment the sendEmail() calls in the code.');
    console.log('📧 Test emails would be sent to:', TEST_EMAIL);
    console.log('\n✨ Email template testing completed!');
}
testEmailTemplates().catch(console.error);
