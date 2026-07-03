-- =============================================================
-- OTIMIZAÇÃO DE PERFORMANCE DAS POLÍTICAS RLS
--
-- auth.uid() dentro de política é reavaliado POR LINHA. Envolvendo em
-- (SELECT auth.uid()) o Postgres avalia UMA vez por consulta (InitPlan)
-- — recomendação oficial do Supabase para tabelas com muitas linhas.
--
-- Reescreve dinamicamente todas as políticas do schema public que usam
-- auth.uid() sem o subselect, preservando nome/comando/roles/expressões.
-- =============================================================

DO $$
DECLARE
  pol RECORD;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual IS NOT NULL AND qual LIKE '%auth.uid()%' AND qual NOT LIKE '%SELECT auth.uid()%')
        OR
        (with_check IS NOT NULL AND with_check LIKE '%auth.uid()%' AND with_check NOT LIKE '%SELECT auth.uid()%')
      )
  LOOP
    new_qual  := replace(pol.qual,       'auth.uid()', '(SELECT auth.uid())');
    new_check := replace(pol.with_check, 'auth.uid()', '(SELECT auth.uid())');

    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);

    stmt := format('CREATE POLICY %I ON public.%I FOR %s', pol.policyname, pol.tablename, pol.cmd);
    IF pol.roles IS NOT NULL AND pol.roles <> '{public}'::name[] THEN
      stmt := stmt || ' TO ' || array_to_string(pol.roles, ', ');
    END IF;
    IF new_qual IS NOT NULL THEN
      stmt := stmt || ' USING (' || new_qual || ')';
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE stmt;
    RAISE NOTICE 'Política otimizada: %.%', pol.tablename, pol.policyname;
  END LOOP;
END $$;
