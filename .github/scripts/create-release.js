const tagName = process.env.TAG_NAME;
const repo = context.repo;

if (!tagName) {
  throw new Error('TAG_NAME environment variable is required');
}

try {
  console.log(`Generating release notes for tag: ${tagName}`);

  // Generate release notes
  const generateNotesResponse = await github.rest.repos.generateReleaseNotes({
    owner: repo.owner,
    repo: repo.repo,
    tag_name: tagName
  });

  const releaseNotes = generateNotesResponse.data.body;
  console.log('Release notes generated successfully');

  // Find the draft release by listing releases and matching the tag
  const { data: releases } = await github.rest.repos.listReleases({
    owner: repo.owner,
    repo: repo.repo,
  });

  const release = releases.find(r => r.tag_name === tagName);
  if (!release) {
    throw new Error(`Release with tag ${tagName} not found`);
  }

  // Update the release to publish it
  await github.rest.repos.updateRelease({
    owner: repo.owner,
    repo: repo.repo,
    release_id: release.id,
    draft: false,
    make_latest: 'true',
    body: releaseNotes
  });

  console.log(`Successfully updated release ${tagName} with generated notes`);
  console.log('Release is now published and marked as latest');
} catch (error) {
  console.error('Error updating release:', error.message);

  // Provide more specific error information
  if (error.status === 404) {
    console.error(`Release with tag ${tagName} not found`);
  } else if (error.status === 403) {
    console.error('Insufficient permissions to update release');
  }

  throw error;
}
