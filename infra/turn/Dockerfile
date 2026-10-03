FROM coturn/coturn:4.18.0-r0@sha256:bbefd3e1fdfdc0d58770fe01b581fd8b00d9f3a5580d00acb77cf719a6bc78e3

# The pinned upstream Debian image does not include `ip`, which start.sh
# needs to select the host's relay interface from its routing table.
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends iproute2 \
 && rm -rf /var/lib/apt/lists/*

USER nobody:nogroup
# Check that the dependency can run as the actual runtime user.
RUN ip -Version
