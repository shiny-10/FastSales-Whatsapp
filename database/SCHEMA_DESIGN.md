# Database Design Document

## 1. Project Information

- Project Name: FastSales WhatsApp
- Version: 1.0
- Database Engine: PostgreSQL
- Schema Source of Truth: SQLAlchemy models under the models/ package

## 2. Database Design Principles

- Modular design
- Normalization where appropriate
- Integer surrogate keys for compatibility with existing application code
- Consistent naming
- Referential integrity
- Scalability for messaging and campaign workloads
- Security through least-privilege database access
- Performance via targeted indexes and JSONB where appropriate

## 3. Naming Standards

- Tables: plural, lowercase
- Primary Key: id
- Foreign Key: <table>_id
- Junction Tables: <table1>_<table2>
- Booleans: is_*
- Timestamps: *_at

## 4. Standard Columns

- id
- created_at
- updated_at
- created_by (optional)
- updated_by (optional)
- is_active (optional)
- is_deleted (optional)

## 5. Module Planning

- Core: organizations, contacts
- Messaging: conversations, conversation_messages, message_logs
- Campaigns: campaigns, campaign_contacts, campaign_recipients
- Automation: auto_replies, chatbot_rules
- Configuration: whatsapp_settings, templates
- Analytics: activity_logs

## 6. Table Design Template

### organizations
- Purpose: Store tenant or business-level organization records.
- Columns: id, name, email, industry, status, created_at
- Primary Key: id
- Foreign Keys: None
- Constraints: name unique
- Indexes: primary key index, unique name index
- Relationships: one-to-many with contacts, campaigns, templates, conversations
- Notes: Used as the main multi-tenant boundary.

### contacts
- Purpose: Store contact records linked to an organization.
- Columns: id, name, phone_number, email, tag, order_id, organization_id, status, created_at
- Primary Key: id
- Foreign Keys: organization_id -> organizations.id
- Constraints: phone_number unique where present
- Indexes: organization_id, phone_number
- Relationships: many-to-one with organizations; many-to-many through campaign_contacts when campaigns are sent
- Notes: Phone number is treated as a key identifier for WhatsApp workflows.

### campaigns
- Purpose: Track outbound messaging campaigns.
- Columns: id, campaign_name, template_id, status, schedule_time, created_at, organization_id
- Primary Key: id
- Foreign Keys: organization_id -> organizations.id
- Constraints: none
- Indexes: organization_id, status
- Relationships: one-to-many with campaign_contacts and campaign_recipients
- Notes: Campaign execution is driven by the application layer.

### templates
- Purpose: Store WhatsApp message templates used by campaigns and workflows.
- Columns: id, template_name, category, language, header, template_body, footer, buttons, status, meta_template_id, meta_template_name, meta_status, organization_id, header_url, header_filename, created_at
- Primary Key: id
- Foreign Keys: organization_id -> organizations.id
- Constraints: none
- Indexes: organization_id, status
- Relationships: one-to-many with campaigns
- Notes: Button payloads and headers are stored as structured JSON.

### whatsapp_settings
- Purpose: Store Meta WhatsApp Business Account integration metadata.
- Columns: id, waba_id, waba_name, phone_display_name, phone_number, phone_quality, status, meta_business_account_id, business_account_name, connected_by, connected_on, access_token_masked, token_expires_on, current_limit_24h, used_in_24h, webhook_url, webhook_token, webhook_status, last_ping, subscribed_events
- Primary Key: id
- Foreign Keys: none
- Constraints: none
- Indexes: phone_number, status
- Relationships: shared configuration for outbound messaging workflows
- Notes: Sensitive values are masked in API responses.

### conversations
- Purpose: Store chat conversation records for inbound and outbound messaging.
- Columns: id, contact_id, customer_phone, customer_name, status, assigned_to, archived, last_message_at, metadata, organization_id, created_at, updated_at
- Primary Key: id
- Foreign Keys: organization_id -> organizations.id
- Constraints: none
- Indexes: organization_id, status, last_message_at
- Relationships: one-to-many with conversation_messages and conversation_reads
- Notes: Used by the shared inbox experience.

### conversation_messages
- Purpose: Store messages inside a conversation thread.
- Columns: id, conversation_id, message_log_id, direction, message_type, text, provider_message_id, attachments, created_at
- Primary Key: id
- Foreign Keys: conversation_id -> conversations.id; message_log_id -> message_logs.id
- Constraints: none
- Indexes: conversation_id, created_at
- Relationships: many-to-one with conversations
- Notes: Supports inbound and outbound message history.

### auto_replies
- Purpose: Store automated reply rules for messaging workflows.
- Columns: id, organization_id, name, match_type, pattern, response_template, active, created_at, updated_at
- Primary Key: id
- Foreign Keys: organization_id -> organizations.id
- Constraints: none
- Indexes: organization_id, active
- Relationships: many-to-one with organizations
- Notes: Rule evaluation is handled by the application layer.

### chatbot_rules
- Purpose: Store chatbot decision rules.
- Columns: id, organization_id, name, conditions, actions, priority, active, created_at, updated_at
- Primary Key: id
- Foreign Keys: organization_id -> organizations.id
- Constraints: none
- Indexes: organization_id, active, priority
- Relationships: many-to-one with organizations
- Notes: Conditions and actions are stored as JSON structures.

## 7. Relationship Mapping

- One-to-One: none in the current core model set
- One-to-Many: organizations -> contacts, campaigns, templates, conversations, auto_replies, chatbot_rules
- Many-to-Many: campaigns <-> contacts via campaign_contacts and campaign_recipients

## 8. Constraints

- Primary Keys: id on each table
- Foreign Keys: organization_id and conversation_id references where applicable
- Unique Constraints: organization name and contact phone number where relevant
- Check Constraints: status values should be restricted in future schema revisions
- Default Values: active or draft defaults on workflow tables
- Cascade Rules: conversation_messages should cascade with conversations when a conversation is removed

## 9. Index Strategy

- Primary Index: id
- Foreign Key Index: organization_id, conversation_id
- Composite Index: organization_id + status
- Unique Index: contact phone number, organization name
- Search Index: JSONB fields and text-based message content can be indexed later if workload grows

## 10. Migration Order

- Enums
- Master Tables
- Core Tables
- Transaction Tables
- Mapping Tables
- History Tables
- Views
- Functions
- Triggers
- Seed Data

## 11. File Structure

- database/
  - models/
  - SCHEMA_DESIGN.md

## 12. Design Checklist

- Naming standards verified
- Relationships defined
- Foreign keys validated
- Constraints documented
- Indexes reviewed
- Cascade rules confirmed
- Audit fields reviewed
- Data types finalized
- Migration order approved

## 13. Change Log

- Version: 1.0
- Date: 2026-07-08
- Description: Replaced the ad hoc SQL migration style with a declarative SQLAlchemy schema design document and schema bootstrap flow.
