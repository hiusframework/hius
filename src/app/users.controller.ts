import { z } from "zod";
import type { UsersService } from "@/app/users.service.ts";
import { NotFoundError } from "@/domain/errors.ts";
import { created, ok } from "@/http/core/response.ts";
import type { HiusRequest } from "@/http/core/types.ts";
import { validate } from "@/http/validation/validate.ts";

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export class UsersController {
  constructor(private readonly service: UsersService) {}

  async create(req: HiusRequest) {
    const input = await validate(req, CreateUserSchema);
    const user = await this.service.createUser(input);
    return created(user);
  }

  async show(req: HiusRequest) {
    const user = await this.service.getById(req.params.id ?? "");
    if (!user) throw new NotFoundError("user");
    return ok(user);
  }
}
