import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../.github/workflows/publish-backend.yml', import.meta.url),
  'utf8',
);

test('backend publication computes matching version and architecture tags for both registries', () => {
  const metadata = workflow
    .split('- name: Compute image name and tags')[1]
    ?.split('- name: Build Docker image (load locally for scan)')[0];

  assert.ok(metadata, 'metadata step must exist');
  assert.ok(metadata.includes('IMAGE_NAME="ghcr.io/${{ github.repository }}-backend"'));
  assert.ok(metadata.includes('DOCKERHUB_IMAGE_NAME="endersonmenezes/codaqui-institucional"'));

  for (const variable of ['IMAGE_NAME', 'DOCKERHUB_IMAGE_NAME']) {
    assert.ok(
      metadata.includes(`-t $${variable}:\${{ env.VERSION }}-amd64 -t $${variable}:latest-amd64 -t $${variable}:\${{ env.VERSION }} -t $${variable}:latest`),
      `${variable} must preserve the amd64 and latest tags`,
    );
    assert.ok(
      metadata.includes(`-t $${variable}:\${{ env.VERSION }}-arm64-v8 -t $${variable}:latest-arm64-v8`),
      `${variable} must preserve the arm64 tags`,
    );
  }
});

test('backend publication logs in and pushes to GHCR and Docker Hub on every run', () => {
  assert.ok(workflow.includes('registry: ghcr.io'));
  assert.ok(workflow.includes('registry: docker.io'));
  assert.ok(workflow.includes('username: endersonmenezes'));
  assert.ok(workflow.includes('password: ${{ secrets.DOCKER_ENDERSONMENEZES_PAT }}'));

  const ghcrPush = workflow.split('- name: Build and push Docker image (GHCR)')[1]?.split('- name:')[0];
  const dockerHubPush = workflow.split('- name: Build and push Docker image (Docker Hub)')[1]?.split('- name:')[0];
  assert.ok(ghcrPush, 'GHCR push must exist');
  assert.ok(dockerHubPush, 'Docker Hub push must exist');
  assert.ok(ghcrPush.includes('${{ steps.image_meta.outputs.tags }}'));
  assert.ok(dockerHubPush.includes('${{ steps.image_meta.outputs.dockerhub_tags }}'));
  assert.ok(!dockerHubPush.includes('if:'), 'Docker Hub must not run only as a failure fallback');

  const verification = workflow.split('- name: Verify registry publications')[1];
  assert.ok(verification, 'the workflow must verify both registry outcomes');
  assert.ok(verification.includes('steps.push_ghcr.outcome'));
  assert.ok(verification.includes('steps.push_dockerhub.outcome'));
});
