const { z } = require("zod");

const loginSchema = z.object({
  login: z.string().trim().min(1).max(255),
  senha: z.string().min(1).max(128)
});

const usuarioSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(255),
  username: z.string().trim().min(3).max(80)
    .regex(/^[a-zA-Z0-9._-]+$/),
  senha: z.string().min(4).max(128),
  perfil: z.enum(["analista"]),
  setorId: z.number().int().positive()
});

const recuperacaoSchema = z.object({
  email: z.string().trim().email().max(255)
});

const redefinirSenhaSchema = z.object({
  token: z.string().min(32).max(256),
  novaSenha: z.string().min(4).max(128)
});

const trocarMinhaSenhaSchema = z.object({
  senha: z.string().min(4).max(128)
});

module.exports = {
  loginSchema,
  usuarioSchema,
  recuperacaoSchema,
  redefinirSenhaSchema,
  trocarMinhaSenhaSchema
};