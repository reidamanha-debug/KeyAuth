// AuthClient.h
// Cliente C++ simples para falar com a API de autenticacao (register/login/validate).
// Depende de libcurl. Sem dependencias externas de JSON (parsing manual simples).

#pragma once
#include <string>

struct AuthResult {
    bool ok = false;
    std::string error;      // preenchido quando ok == false
    std::string message;    // texto adicional (ex: "conta_criada")
    std::string token;      // preenchido no login
    std::string expiresAt;  // data de expiracao (ISO 8601)
};

class AuthClient {
public:
    // baseUrl exemplo: "http://127.0.0.1:3000" ou "https://seu-dominio.com"
    explicit AuthClient(std::string baseUrl);

    // Retorna um identificador estavel da maquina (hash do machine-id / volume serial).
    static std::string GetHWID();

    // Resgata uma chave de licenca e cria a conta (username/password) do usuario final.
    AuthResult Register(const std::string& licenseKey,
                         const std::string& username,
                         const std::string& password);

    // Loga com username/password. Preenche result.token em caso de sucesso.
    AuthResult Login(const std::string& username, const std::string& password);

    // Confirma que a sessao (token) ainda e valida. Chame periodicamente (ex: a cada minuto).
    AuthResult Validate(const std::string& token);

private:
    std::string m_baseUrl;
    AuthResult PostJson(const std::string& path, const std::string& jsonBody);
};
