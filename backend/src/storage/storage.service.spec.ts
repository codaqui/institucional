import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should accept valid https URLs', () => {
    expect(() =>
      service.validateReceiptUrl('https://drive.google.com/file/d/abc123/view'),
    ).not.toThrow();
  });

  it('should reject invalid URLs', () => {
    expect(() => service.validateReceiptUrl('not-a-url')).toThrow();
  });

  it('should reject non-http protocols', () => {
    expect(() => service.validateReceiptUrl('ftp://example.com/file')).toThrow();
  });
});
