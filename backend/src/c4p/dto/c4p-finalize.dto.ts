import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

export class FinalizeC4pCallDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  talkIds: string[];
}
