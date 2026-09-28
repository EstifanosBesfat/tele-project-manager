import { resolvePoolSsl } from '@ethio/database';

describe('resolvePoolSsl', () => {
  it('leaves local Postgres without TLS', () => {
    expect(
      resolvePoolSsl('postgresql://ethio:ethio@localhost:5432/project_manager'),
    ).toBeUndefined();
    expect(
      resolvePoolSsl('postgresql://ethio:ethio@127.0.0.1:55432/project_manager'),
    ).toBeUndefined();
  });

  it('verifies the server certificate for Neon and sslmode=require', () => {
    expect(
      resolvePoolSsl(
        'postgresql://u:p@ep-test-pooler.us-east-1.aws.neon.tech/neondb',
      ),
    ).toEqual({ rejectUnauthorized: true });
    expect(
      resolvePoolSsl('postgresql://u:p@db.example.com/app?sslmode=require'),
    ).toEqual({ rejectUnauthorized: true });
    expect(
      resolvePoolSsl('postgresql://u:p@hayabusa.proxy.rlwy.net:28849/app'),
    ).toEqual({ rejectUnauthorized: true });
  });

  it('honors sslmode=disable even on a Neon host', () => {
    expect(
      resolvePoolSsl(
        'postgresql://u:p@ep-test.neon.tech/neondb?sslmode=disable',
      ),
    ).toBeUndefined();
  });
});
