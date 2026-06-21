ALTER TABLE staff_chat_messages ADD COLUMN message_type TEXT DEFAULT 'text';
ALTER TABLE staff_chat_messages ADD COLUMN location_data TEXT DEFAULT '';
