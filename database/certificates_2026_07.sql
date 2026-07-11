-- ═══════════════════════════════════════════════════════════════════════════
-- CERTIFICADOS DA ACADEMIA — julho 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Até aqui o certificado era 100% client-side: código DERIVADO de
-- course.id+userName+data (mudava se o user renomeasse o perfil, colidia
-- entre homónimos, impossível de verificar). Esta tabela torna-o real:
--   • code gerado no servidor (XPM- + 10 hex), único e permanente;
--   • verificação pública em xp-money.com/verify/<code>;
--   • é o pré-requisito da visão cripto (ancoragem on-chain futura).
--
-- A app funciona SEM esta migração (fallback runtime — o certificado
-- continua com o código derivado, apenas sem URL de verificação).
--
-- Correr no Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS certificates (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id  TEXT NOT NULL,
  code       TEXT NOT NULL UNIQUE,
  user_name  TEXT,
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_code    ON certificates(code);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);

-- RLS: acesso apenas via service-role (todas as leituras/escritas passam
-- pelas rotas API do servidor — incluindo a verificação pública, que só
-- expõe curso + primeiro nome + data).
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
