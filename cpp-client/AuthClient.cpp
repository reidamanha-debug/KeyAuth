// AuthClient.cpp
#include "AuthClient.h"
#include "sha256.h"
#include <curl/curl.h>
#include <fstream>
#include <sstream>
#include <regex>

#if defined(_WIN32)
  #include <windows.h>
#elif defined(__APPLE__)
  #include <cstdio>
  #include <memory>
#else
  // Linux
#endif

// ---------- utilidades internas ----------

static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
    static_cast<std::string*>(userp)->append(static_cast<char*>(contents), size * nmemb);
    return size * nmemb;
}

static std::string JsonEscape(const std::string& s) {
    std::string out;
    for (char c : s) {
        if (c == '"' || c == '\\') out += '\\';
        out += c;
    }
    return out;
}

// Extrai o valor de uma string JSON simples (nao lida com objetos/arrays aninhados,
// suficiente para as respostas planas desta API).
static std::string JsonGetString(const std::string& body, const std::string& key) {
    std::regex re("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
    std::smatch m;
    if (std::regex_search(body, m, re)) return m[1].str();
    return "";
}

static bool JsonGetBool(const std::string& body, const std::string& key, bool defaultValue = false) {
    std::regex re("\"" + key + "\"\\s*:\\s*(true|false)");
    std::smatch m;
    if (std::regex_search(body, m, re)) return m[1].str() == "true";
    return defaultValue;
}

// ---------- HWID ----------

std::string AuthClient::GetHWID() {
    std::string raw;

#if defined(_WIN32)
    char volumeName[MAX_PATH + 1] = {0};
    char fileSystemName[MAX_PATH + 1] = {0};
    DWORD serialNumber = 0, maxCompLen = 0, fsFlags = 0;
    if (GetVolumeInformationA("C:\\", volumeName, MAX_PATH, &serialNumber, &maxCompLen, &fsFlags,
                              fileSystemName, MAX_PATH)) {
        raw += std::to_string(serialNumber);
    }
    char computerName[MAX_COMPUTERNAME_LENGTH + 1];
    DWORD size = sizeof(computerName);
    if (GetComputerNameA(computerName, &size)) raw += computerName;

#elif defined(__APPLE__)
    // Usa o IOPlatformUUID como identificador estavel do Mac.
    std::array<char, 256> buffer{};
    std::string cmdOut;
    std::unique_ptr<FILE, decltype(&pclose)> pipe(
        popen("ioreg -rd1 -c IOPlatformExpertDevice | awk -F'\"' '/IOPlatformUUID/{print $4}'", "r"),
        pclose);
    if (pipe) {
        while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) cmdOut += buffer.data();
    }
    raw = cmdOut;

#else
    // Linux: machine-id e um identificador estavel por instalacao do SO.
    std::ifstream f("/etc/machine-id");
    if (f.good()) {
        std::stringstream ss;
        ss << f.rdbuf();
        raw = ss.str();
    }
#endif

    if (raw.empty()) raw = "hwid-indisponivel"; // fallback (evite usar isso em producao)
    return SHA256::hashString(raw);
}

// ---------- AuthClient ----------

AuthClient::AuthClient(std::string baseUrl) : m_baseUrl(std::move(baseUrl)) {
    curl_global_init(CURL_GLOBAL_DEFAULT);
}

AuthResult AuthClient::PostJson(const std::string& path, const std::string& jsonBody) {
    AuthResult result;
    CURL* curl = curl_easy_init();
    if (!curl) {
        result.ok = false;
        result.error = "falha_ao_iniciar_curl";
        return result;
    }

    std::string url = m_baseUrl + path;
    std::string responseBody;

    struct curl_slist* headers = nullptr;
    headers = curl_slist_append(headers, "Content-Type: application/json");

    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, jsonBody.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &responseBody);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 15L);
    curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L); // mantenha ligado em producao (HTTPS)

    CURLcode res = curl_easy_perform(curl);
    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if (res != CURLE_OK) {
        result.ok = false;
        result.error = std::string("erro_de_rede: ") + curl_easy_strerror(res);
        return result;
    }

    result.ok = JsonGetBool(responseBody, "ok", false);
    result.error = JsonGetString(responseBody, "error");
    result.message = JsonGetString(responseBody, "message");
    result.token = JsonGetString(responseBody, "token");
    result.expiresAt = JsonGetString(responseBody, "expires_at");
    return result;
}

AuthResult AuthClient::Register(const std::string& licenseKey, const std::string& username, const std::string& password) {
    std::string hwid = GetHWID();
    std::ostringstream body;
    body << "{"
         << "\"license_key\":\"" << JsonEscape(licenseKey) << "\","
         << "\"username\":\"" << JsonEscape(username) << "\","
         << "\"password\":\"" << JsonEscape(password) << "\","
         << "\"hwid\":\"" << JsonEscape(hwid) << "\""
         << "}";
    return PostJson("/api/register", body.str());
}

AuthResult AuthClient::Login(const std::string& username, const std::string& password) {
    std::string hwid = GetHWID();
    std::ostringstream body;
    body << "{"
         << "\"username\":\"" << JsonEscape(username) << "\","
         << "\"password\":\"" << JsonEscape(password) << "\","
         << "\"hwid\":\"" << JsonEscape(hwid) << "\""
         << "}";
    return PostJson("/api/login", body.str());
}

AuthResult AuthClient::Validate(const std::string& token) {
    std::string hwid = GetHWID();
    std::ostringstream body;
    body << "{"
         << "\"token\":\"" << JsonEscape(token) << "\","
         << "\"hwid\":\"" << JsonEscape(hwid) << "\""
         << "}";
    return PostJson("/api/validate", body.str());
}
