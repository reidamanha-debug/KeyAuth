// main_example.cpp
// Exemplo de fluxo: primeiro uso resgata a chave (Register), usos seguintes fazem Login + Validate.
#include "AuthClient.h"
#include <iostream>

int main() {
    AuthClient auth("http://127.0.0.1:3000"); // troque pela URL/dominio real do seu servidor (use https em producao)

    std::cout << "1) Ja tenho conta (login)\n2) Primeira vez (tenho uma chave para resgatar)\nEscolha: ";
    int opcao;
    std::cin >> opcao;

    std::string token;

    if (opcao == 2) {
        std::string chave, usuario, senha;
        std::cout << "Chave de licenca: "; std::cin >> chave;
        std::cout << "Escolha um usuario: "; std::cin >> usuario;
        std::cout << "Escolha uma senha: "; std::cin >> senha;

        AuthResult reg = auth.Register(chave, usuario, senha);
        if (!reg.ok) {
            std::cout << "Falha ao registrar: " << reg.error << "\n";
            return 1;
        }
        std::cout << "Conta criada! Expira em: " << reg.expiresAt << "\n";

        AuthResult login = auth.Login(usuario, senha);
        if (!login.ok) { std::cout << "Falha ao logar: " << login.error << "\n"; return 1; }
        token = login.token;

    } else {
        std::string usuario, senha;
        std::cout << "Usuario: "; std::cin >> usuario;
        std::cout << "Senha: "; std::cin >> senha;

        AuthResult login = auth.Login(usuario, senha);
        if (!login.ok) { std::cout << "Falha ao logar: " << login.error << "\n"; return 1; }
        token = login.token;
        std::cout << "Login ok! Expira em: " << login.expiresAt << "\n";
    }

    // A partir daqui, guarde "token" e chame Validate() periodicamente
    // (ex: a cada 60s numa thread separada) para garantir que a sessao
    // continua valida (nao expirou, nao foi banido, HWID confere).
    AuthResult check = auth.Validate(token);
    std::cout << "Validate -> ok=" << check.ok << (check.ok ? "" : (" erro=" + check.error)) << "\n";

    std::cout << "\n>>> Usuario autenticado, liberar o resto do programa aqui <<<\n";
    return 0;
}
