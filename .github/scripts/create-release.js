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

  // Update the release
  await github.rest.repos.updateRelease({
    owner: repo.owner,
    repo: repo.repo,
    tag: tagName,
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
