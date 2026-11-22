
const API = {
    async request(url, options = {}) {
        const token = sessionStorage.getItem("token");

        const headers = {
            ...options.headers
        };

        let body = options.body;

        if (body instanceof FormData) {
            delete headers["Content-Type"];
            delete headers["content-type"];
        } else if (body !== undefined && body !== null) {
            headers["Content-Type"] = "application/json";

            if (typeof body !== "string") {
                body = JSON.stringify(body);
            }
        }

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        let response;

        try {
            response = await fetch(url, {
                ...options,
                headers,
                body
            });
        } catch (erro) {
            throw new Error(
                "Não foi possível conectar ao servidor. Verifique sua conexão."
            );
        }

        const texto = await response.text();
        const contentType = response.headers.get("content-type") || "";

        let data = {};
        let respostaJson = false;

        if (texto) {
            try {
                data = JSON.parse(texto);
                respostaJson = true;
            } catch {
                data = {};
            }
        }

        // Impede que páginas HTML sejam exibidas como mensagens.
        const respostaHtml =
            contentType.includes("text/html") ||
            /^\s*(<!doctype html|<html)/i.test(texto);

        if (response.status === 401) {
            sessionStorage.removeItem("token");

            if (!url.includes("/api/auth/login")) {
                window.location.href = "/";
            }

            throw new Error(
                respostaJson
                    ? data.mensagem || "Usuário ou senha incorretos."
                    : "Sua sessão expirou. Entre novamente."
            );
        }

        if (
            response.status === 403 &&
            respostaJson &&
            data.codigo === "SENHA_TEMPORARIA"
        ) {
            throw new Error(
                data.mensagem ||
                "É necessário alterar a senha para continuar."
            );
        }

        if (!response.ok) {
            if (respostaJson) {
                throw new Error(
                    data.erro ||
                    data.mensagem ||
                    "Não foi possível concluir a operação."
                );
            }

            if (respostaHtml) {
                if (response.status === 404) {
                    throw new Error(
                        "O serviço solicitado não foi encontrado. Verifique a rota da API."
                    );
                }

                throw new Error(
                    "O servidor apresentou uma resposta inesperada. Tente novamente."
                );
            }

            throw new Error(
                "Erro na comunicação com o servidor. Tente novamente."
            );
        }

        if (!respostaJson && texto) {
            throw new Error(
                "O servidor retornou uma resposta inválida."
            );
        }

        return data;
    },

    get(url) {
        return this.request(url);
    },

    post(url, body) {
        return this.request(url, {
            method: "POST",
            body: body instanceof FormData
                ? body
                : JSON.stringify(body)
        });
    },

    patch(url, body) {
        return this.request(url, {
            method: "PATCH",
            body: JSON.stringify(body)
        });
    },

    upload(url, formData) {
        return this.request(url, {
            method: "POST",
            body: formData
        });
    },

    delete(url) {
        return this.request(url, {
            method: "DELETE"
        });
    }
};
