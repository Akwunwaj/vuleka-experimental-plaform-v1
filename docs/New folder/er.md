Docs
Overview
About the WhatsApp Business Platform
About the WhatsApp Business Platform
Updated: Jun 2, 2026

The WhatsApp Business Platform enables businesses to communicate with customers at scale.
This documentation is intended for developers using our APIs. If you are looking for information on other ways to use WhatsApp for your business see the WhatsApp Business site⁠.
Core APIs and capabilities
WhatsApp Business Platform Cloud API
The WhatsApp Business Platform Cloud API enables you to programmatically message and call on WhatsApp. You can use Cloud API to send users a variety of messages, from simple text messages to rich media and interactive messages.
Cloud API includes:
Messaging: Send text messages, rich media, and interactive messages
Calling: Make and receive calls to customers
Groups: Create, manage, and message WhatsApp group conversations
WhatsApp messaging provides a powerful and private way to engage with customers. Use Cloud API to:
Send order confirmations and shipping updates
Share appointment availability and other reminders
Drive upsell and cross-sell opportunities
Facilitate end-to-end transactions, from product discovery to payment
Enable multi-factor authentication or one-time passwords to verify accounts and users
Deliver custom interactive conversational experiences
Learn more about message types on Cloud API.
WhatsApp Business Platform Business Management API
The WhatsApp Business Management API enables you to programmatically manage a WhatsApp Business Account and its associated assets.
Manage account assets with Business Management API like:
Business phone numbers: Add and remove phone numbers associated with your business
Templates: Create and modify message templates for scalable messaging.
Business Management API also gives you access to account analytics like:
Messaging analytics: The number and type of messages sent and delivered.
Pricing analytics: Granular pricing breakdowns for delivered messages.
Template analytics: Sent/read/delivered template metrics, alongside template message button clicks.
Learn more about message templates.
Learn more about managing business phone numbers.
Learn more about account analytics.
Marketing Messages API for WhatsApp
MM API for WhatsApp is an API for sending optimized marketing messages on WhatsApp.
When you send marketing messages through the MM API for WhatsApp, you can access new features not available on Cloud API and get automatic optimizations, so high engagement messages can reach more customers.
The MM API for WhatsApp includes:
Quality-based delivery: Up to 9% higher marketing message deliveries over Cloud API for high engagement content.
Automated creative optimizations: Automatic enhancements to marketing creative to increase message performance.
Performance benchmarks and recommendations: Comparison of read and click rates versus similar templates from businesses in your region.
Conversion metrics: Measure marketing messages that lead users to perform app events such as ‘Add to Cart’, ‘Checkout Initiated’, or ‘Purchase’.
Learn more about the Marketing Messages API for WhatsApp.
Webhooks
Webhooks deliver JSON payloads to your server for message status updates, incoming messages, asynchronous error handling, and many other notification utilities.
The platform relies heavily on webhooks, as the contents of any message sent from a WhatsApp user to your business phone number is communicated via webhook, and all outgoing message delivery status updates are reported via webhook.
Learn more about webhooks.
Meta Business Agent
Meta Business Agent lets you configure and operate AI-powered agents on WhatsApp. Agents handle conversations with WhatsApp users autonomously, using knowledge sources you provide (FAQs, business info, product catalogs, files, and websites) and custom connectors to your external APIs.
Meta Business Agent includes:
Agent configuration: Set agent behavior, persona, language, and system instructions
Knowledge management: Connect FAQs, business info, catalogs, files, and websites for the agent to reference
Custom connectors: Integrate your external APIs so the agent can take actions like checking order status or booking appointments
Thread control: Manage handoffs between the AI agent and human agents
Evaluation and testing: Test agent responses and evaluate performance
Learn more about Meta Business Agent.
Technical foundations
HTTP protocol and API requests
The WhatsApp Business Platform is built on Graph API and uses HTTP protocol. API requests include path, body, and header parameters.
Example: Sending a text message using cURL
curl 'https://graph.facebook.com/v17.0/106540352242922/messages' \
 -H 'Content-Type: application/json' \
 -H 'Authorization: Bearer EAAJB...' \
 -d '{
"messaging_product": "whatsapp",
"recipient_type": "individual",
"to": "+16505555555",
"type": "text",
"text": {
"preview_url": true,
"body": "Here's the info you requested! https://www.meta.com/quest/quest-3/"
}
}'
Learn more about the Graph API.
JSON responses
API responses are formatted in JSON.
Example: Requesting a business phone number’s metadata
{
"verified_name": "Lucky Shrub",
"code_verification_status": "VERIFIED",
"display_phone_number": "15550783881",
"quality_rating": "GREEN",
"platform_type": "CLOUD_API",
"throughput": {
"level": "STANDARD"
},
"webhook_configuration": {
"application": "https://www.luckyshrub.com/webhooks"
},
"id": "106540352242922"
}
Authentication and authorization
Authentication uses OAuth (not 2.0) access tokens, while permissions restrict access to specific resources.
Learn more about access tokens.
Learn more about permissions.
Key resources
Business portfolios
A business portfolio allows organizations to bring all their Meta business assets together so they can be managed in one place. On the WhatsApp Business Platform, a business portfolio mainly serves as a container for WhatsApp Business Accounts (WABA). You must have a business portfolio to use the platform.
Business portfolios can be verified, and verification status factors into improved functionality, such as higher throughput and Official Business Account status.
Learn more about business portfolios.⁠
WhatsApp Business Accounts (WABA)
A WhatsApp Business Account represents your business and contains phone numbers, usernames and analytics.
Learn more about WhatsApp Business Accounts.
Business phone numbers
Business phone numbers, real or virtual, are used for sending and receiving WhatsApp messages. They can have display names and earn Official Business Account status.
Learn more about business phone numbers.
Message templates
Templates are customizable messages that you can construct in advance of sending them. Template messages generally require approval before you can send them.
Templates are useful for messaging at scale. They are also the only type of message that can be sent to WhatsApp users outside of a customer service window.
Templates have quality scores and are subject to various messaging limits.
Learn more about message templates.
Test resources
When you get started with Cloud API, a test WhatsApp Business Account and test business phone number are automatically created for you. Test WhatsApp Business Accounts and test phone numbers are useful for testing purposes, as they have relaxed messaging limits and don’t require a payment method on file in order to send template messages.
You can delete your business portfolio and its test resources if:
You are an admin on the business portfolio associated with the app
No other apps are associated with the business portfolio
The business portfolio is not associated with any other WhatsApp Business Accounts
The WhatsApp Business Account is not associated with any other business phone numbers.
To delete your business portfolio and its test resources:
Go to the App Dashboard > WhatsApp > Configuration panel.
Locate the Test Account section.
Click the Delete button.
We recommend using our API Playground when testing endpoints. You can find the playground in the “API Reference” section on the left sidebar of this page. In each reference, there is a “Try it” button which opens the playground.
Also helpful for testing is our Postman collection⁠.
Tools and integrations
WhatsApp Manager
WhatsApp Manager is a web app for managing WhatsApp Business Accounts, Messaging Accounts, phone numbers, templates, and reviewing analytics.
Access WhatsApp Manager⁠
Third-party SDKs
Some SDKs, like PyWa⁠ (Python wrapper), are available but are not maintained or endorsed by Meta.
Postman collection
The official Postman collection lets you execute common API queries.
Access the WhatsApp Business Platform Postman collection⁠.
Security and performance
Throughput
Business phone numbers can send up to 80 messages per second by default, with capacity upgrades available.
Learn more about throughput.
Encryption
With Cloud API, every WhatsApp message continues to be protected by Signal protocol encryption that secures messages before they leave the device. This means messages with a WhatsApp Business Account are securely delivered to the destination chosen by each business.
Cloud API uses industry standard encryption techniques to protect data in transit and at rest. Cloud API uses Graph API for sending messages and Webhooks for receiving events, and both operate over industry standard HTTPS, protected by TLS.
See the WhatsApp Encryption Overview technical whitepaper⁠ for additional details.
Scaling
The Cloud API automatically scales usage within your rate limits.
Rate limits
Requests made by your app on your WhatsApp Business Account (WABA) are counted against your app’s request count. An app’s request count is the number of requests it can make during a rolling one hour.
For the following endpoints, your app can make 200 requests per hour, per app, per WABA, by default. For active WABAs with at least one registered phone number, your app can make 5000 requests per hour, per app, per active WABA.
Type of request Endpoint
GET
/<WHATSAPP_BUSINESS_ACCOUNT_ID>
GET, POST, and DELETE
/<WHATSAPP_BUSINESS_ACCOUNT_ID>/assigned_users
GET
/<WHATSAPP_BUSINESS_ACCOUNT_ID>/phone_numbers
GET, POST, and DELETE
/<WHATSAPP_BUSINESS_ACCOUNT_ID>/message_templates
GET, POST, and DELETE
/<WHATSAPP_BUSINESS_ACCOUNT_ID>/subscribed_apps
GET
/<WHATSAPP_BUSINESS_ACCOUNT_TO_NUMBER_CURRENT_STATUS_ID>
For the following Credit Line API requests, your app can make 5000 requests per hour.
Type of request Endpoint
GET
/<BUSINESS_ID>/extendedcredits
POST
/<EXTENDED_CREDIT_ID>/whatsapp_credit_sharing_and_attach
GET and DELETE
/<ALLOCATION_CONFIG_ID>
GET
/<EXTENDED_CREDIT_ID>/owning_credit_allocation_configs
For more information on how to get your current rate usage, see Headers.
In addition, the platform applies several message rate limits:
Test message rate limit (for unverified WABAs)
Quality rating and messaging limits (for verified WABAs)
Capacity rate limit (for all accounts)
Business phone rate limit (per phone number)
Pair rate limits
Business phone numbers can send 1 message every 6 seconds to the same WhatsApp user (0.17 messages/second), which equals about 10 messages per minute or 600 per hour. Exceeding this limit triggers error code 131056 until you are back within the allowed rate.
You may send up to 45 messages in a 6-second burst, but this “borrows” from your future quota. After a burst, you must wait the equivalent time it would take to send those messages at the normal rate (for example, a burst of 20 requires a ~2-minute wait before sending more to that user).
To manage post-burst throttling, if a send request fails, retry after 4^X seconds (starting with X=0 and increasing X by 1 after each failure) until successful.
Terms and policies
User opt-in
You must obtain user opt-in before sending message templates. Opt-in must clarify your business name and intent.
Learn more about the WhatsApp Business Messaging Policy.⁠
Terms and policies
All WhatsApp Business Platform use must comply with our terms and policies. Using unauthorized third-party tools is prohibited.
Learn more about terms and policies.⁠
Next steps
Get started with the WhatsApp Business Platform.
Learn more
Display names
Phone numbers
Pricing
Webhooks
