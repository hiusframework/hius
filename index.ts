import { bootstrapModule, Injectable, Module } from "@/index.ts";

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
console.log(`UserService: ${service.getUser()}`); // "ok"

const controller = app.resolve(UserController);
console.log(`UserController: ${controller.handle()}`); // "ok"
