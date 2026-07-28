---
name: spring-boot-skeleton
description: >-
  Scaffolds and maintains a complete minimal Spring Boot API backend for the
  house hobby project under backend/, using the latest stable Spring Boot and
  Java 21. Use when creating or extending the Maven skeleton, application
  entrypoint, application.yml, CORS/SPA config, or API envelope conventions.
---

# Spring Boot Skeleton

自足規格：依本 skill 即可產生可啟動的完整後端骨架與基礎程式，不需依賴任何外部專案。使用**當下最新穩定 Spring Boot** + Java 21。

## When to use

- 從零建立 `backend/`，或調整骨架設定
- 與 Vue 前端透過 `VITE_API_URL` 對接
- 之後新增 Controller／API 時延續本目錄與回應格式

## Scaffold checklist

1. 建立 `backend/`：`pom.xml`、Maven Wrapper（`mvnw`／`mvnw.cmd`）
2. `*Application.java` + `*ApplicationTests.java`
3. `application.yml`（port、application name）
4. 可選：`config/CorsConfig`（前後端分離開發）
5. 可選：健康／示範 Controller（回傳 `{ metadata, body }`）
6. `./mvnw clean test` 通過；`./mvnw spring-boot:run` 可啟動

## Tech stack

| 項目 | 採用 |
|------|------|
| Spring Boot | scaffold 當下查 **最新穩定版**（撰寫時參考 **4.1.x**；以 Maven Central／spring.io 為準） |
| Java | **21** |
| 建置 | Maven + Maven Wrapper |
| 依賴 | `spring-boot-starter-web`、`spring-boot-starter-validation`、`spring-boot-starter-test` |

### Version policy

1. 建立或升級前查最新 **stable** Spring Boot，寫入 `spring-boot-starter-parent`。
2. Skill 內版號僅供參考，以查到的穩定版為準。
3. 維持 Java 21，除非使用者另行指定。

## Folder structure

```
backend/
├── pom.xml
├── mvnw
├── mvnw.cmd
├── src/main/java/<basePackage>/
│   ├── HouseApplication.java          # 名稱依專案調整
│   ├── config/
│   │   ├── CorsConfig.java            # 可選
│   │   └── SpaWebMvcConfigurer.java   # 可選：同 JAR 提供前端時
│   ├── common/                        # 可選：ApiEnvelope、錯誤處理
│   │   ├── ApiEnvelope.java
│   │   └── ApiMetadata.java
│   └── web/                           # 可選：示範或健康檢查 Controller
├── src/main/resources/
│   └── application.yml
└── src/test/java/<basePackage>/
    └── HouseApplicationTests.java
```

- 後端固定放在 repo 根目錄下的 **`backend/`**，與前端分離。
- **groupId／artifactId／basePackage**：依 `house` 命名，例如 `com.example.house` / `house-api`。

## `pom.xml` 要點

```xml
<parent>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-parent</artifactId>
  <version><!-- 最新穩定版 --></version>
  <relativePath/>
</parent>

<properties>
  <java.version>21</java.version>
</properties>

<!-- dependencies: web, validation, test(scope=test) -->
<!-- build: spring-boot-maven-plugin -->
```

可選 Maven profile：若 `../dist/index.html` 存在，用 `maven-resources-plugin` 在 `process-resources` 將 `../dist` 複製到 `${project.build.outputDirectory}/static`，方便單一 JAR 提供 SPA。

## `application.yml`

```yaml
spring:
  application:
    name: house-api

server:
  port: 8080
```

前端 `VITE_API_URL` 需對齊（例：`http://localhost:8080`）。

## Application entry

```java
@SpringBootApplication
public class HouseApplication {
  public static void main(String[] args) {
    SpringApplication.run(HouseApplication.class, args);
  }
}
```

測試：

```java
@SpringBootTest
class HouseApplicationTests {
  @Test
  void contextLoads() {}
}
```

## API envelope（與前端對齊）

成功回應建議固定為：

```json
{
  "metadata": { "code": "200", "message": "OK" },
  "body": { }
}
```

Java 可用簡單 record／DTO：

```java
public record ApiMetadata(String code, String message) {}
public record ApiEnvelope<T>(ApiMetadata metadata, T body) {
  public static <T> ApiEnvelope<T> ok(T body) {
    return new ApiEnvelope<>(new ApiMetadata("200", "OK"), body);
  }
}
```

Controller 路徑建議以 `/api/<domain>/...` 對齊前端 `api('<domain>/...')`。

## Optional config

### CORS（本機前後端分離）

允許前端 origin（如 `http://localhost:5173`），methods／headers 依需求開放；生產環境再收斂。

### SPA fallback（同 JAR 提供前端時）

實作 `WebMvcConfigurer`：

- 靜態資源從 `classpath:/static/`
- 非檔案、非 `api/**` 的路徑 fallback 到 `index.html`
- 啟用前可設 `spring.web.resources.add-mappings: false`，改由該 config 註冊，避免重複映射

## Commands

於 `backend/`：

```bash
./mvnw clean test
./mvnw clean package
./mvnw spring-boot:run
```

驗證：`BUILD SUCCESS`；服務起來後可 `curl` 根路徑或示範 API。尚無 Controller 時 Whitelabel 404 仍代表容器已啟動。

## Frontend pairing

- 前端 skill：`vue-frontend-framework`
- `VITE_API_URL` = 本服務基底 URL
- 回應格式與錯誤碼與前端 `apis/api.models.ts`／`api.constant.ts` 一致

## Interest-project scope

目標：能啟動、能對接、可擴充。資料庫、Security／JWT、完整業務分層等，等有明確需求再加。
