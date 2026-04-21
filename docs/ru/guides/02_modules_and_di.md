# Модули и внедрение зависимостей

> 🚧 Руководство в процессе написания.

## Обзор

Hius использует модульную систему, вдохновлённую NestJS, но без магии — все зависимости явные.

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

Зависимости объявляются явно в виде массива, порядок соответствует параметрам конструктора.
Без `reflect-metadata`, без магии компилятора.

## bootstrapModule

```ts
const app = bootstrapModule(AppModule);
const service = app.resolve(UserService);
```

Рекурсивно загружает все импортированные модули, регистрирует провайдеры и возвращает настроенный контейнер.

## Контейнер

Все провайдеры работают в **singleton-скоупе**: создаются один раз, затем кешируются.

```ts
container.register(MyService, () => new MyService());
container.resolve(MyService); // всегда один и тот же экземпляр
```
