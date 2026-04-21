import { Module, Injectable, bootstrapModule } from "./src/index.ts";

@Injectable()
class UserService {
  getUser(): string {
    return "ok";
  }
}

@Injectable([UserService])
class UserController {
  constructor(private userService: UserService) {}

  handle(): string {
    return this.userService.getUser();
  }
}

@Module({
  name: "app",
  providers: [UserService, UserController],
})
class AppModule {}

const app = bootstrapModule(AppModule);

const service = app.resolve(UserService);
console.log(service.getUser()); // "ok"

const controller = app.resolve(UserController);
console.log(controller.handle()); // "ok"
