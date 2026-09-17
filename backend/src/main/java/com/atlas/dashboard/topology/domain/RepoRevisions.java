package com.atlas.dashboard.topology.domain;

import java.util.List;

/**
 * The revisions a repository's map can be viewed at: the deployed environments (each pinned to a
 * commit and container image) and a list of recent commits. A commit that isn't deployed to any
 * environment can still be mapped (topology only) — there's no live data flow because nothing is
 * running that revision.
 */
public record RepoRevisions(List<Environment> environments, List<CommitRef> commits) {

    /** A deployed environment: what commit/image is currently running there. */
    public record Environment(String env, String commitHash, String image) {
    }

    /** A recent commit; {@code deployedEnv} names the environment running it, or null if none. */
    public record CommitRef(String hash, String message, String deployedEnv) {
    }
}
