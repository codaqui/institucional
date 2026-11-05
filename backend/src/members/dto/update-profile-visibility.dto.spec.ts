import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileVisibilityDto } from './update-profile-visibility.dto';

describe('UpdateProfileVisibilityDto', () => {
  it('accepts a partial update with one boolean key', async () => {
    const dto = plainToInstance(UpdateProfileVisibilityDto, { bio: false });
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects non-boolean values', async () => {
    const dto = plainToInstance(UpdateProfileVisibilityDto, { bio: 'false' });
    await expect(validate(dto)).resolves.toHaveLength(1);
  });
});
