import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration018ExternalEventActivationStartAt
  implements MigrationInterface
{
  name = 'Migration018ExternalEventActivationStartAt1785385200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'external_event_activations',
      new TableColumn({
        name: 'startAt',
        type: 'timestamptz',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('external_event_activations', 'startAt');
  }
}
