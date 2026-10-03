-- Presença pós-Sorteio, parte 1: o novo valor precisa estar commitado antes de
-- qualquer função ou constraint citá-lo (ALTER TYPE ... ADD VALUE), por isso
-- fica sozinho. O resto está em 20261003170000_event_sort_after.sql.
alter type public.attendance_status add value 'left';
