# Modules & Dependency Injection

> 🚧 This guide is a work in progress.

## Overview

Hius uses a module system inspired by NestJS but without magic — all dependencies are explicit.

## @Module

```ts
@Module({
  name: "users",
  imports: [DatabaseModule],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
class UsersModule {}
```

## @Injectable

```ts
@Injectable([UserRepository])
class UserService {
  constructor(private repo: UserRepository) {}
}
```

Dependencies are declared explicitly as an array matching constructor parameter order.
No `reflect-metadata`, no compiler magic.

## bootstrapModule

```ts
const app = bootstrapModule(AppModule);
const service = app.resolve(UserService);
```

Recursively loads all imported modules, registers providers, and returns a configured container.

## Container

All providers are **singleton-scoped**: resolved once, then cached.

```ts
container.register(MyService, () => new MyService());
container.resolve(MyService); // same instance every time
```
