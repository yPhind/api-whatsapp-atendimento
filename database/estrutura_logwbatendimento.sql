--------------------------------------------------------------------
#LIMPEZA NO BANCO
--------------------------------------------------------------------
DO $$
DECLARE
    tabelas TEXT;
BEGIN
    SELECT STRING_AGG(
        FORMAT('%I.%I', schemaname, tablename),
        ', '
    )
    INTO tabelas
    FROM pg_tables
    WHERE schemaname = 'public';

    IF tabelas IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || tabelas ||
                ' RESTART IDENTITY CASCADE';
    END IF;
END $$;
--------------------------------------------------------------------
#LIMPEZA NO BANCO
--------------------------------------------------------------------
--------------------------------------------------------------------
#CONFIRMAÇÃO DE LIMPEZA NO BANCO
--------------------------------------------------------------------

--------------------------------------------------------------------
#CONFIRMAÇÃO DE LIMPEZA NO BANCO
--------------------------------------------------------------------
