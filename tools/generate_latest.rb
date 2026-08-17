#!/usr/bin/env ruby
# frozen_string_literal: true

require 'optparse'
require 'pathname'
require 'digest'
require 'base64'
require 'time'

VERSION_PATTERN = %r{^.+_v(?<version>\d+\.\d+\.\d+-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)\.(?<extension>mcaddon|brproject)$}i
SUPPORTED_EXTENSIONS = ['.mcaddon', '.brproject'].freeze

def calculate_sha512(path)
  sha512 = Digest::SHA512.new
  path.open('rb') do |file|
    while (chunk = file.read(1024 * 1024))
      sha512.update(chunk)
    end
  end
  Base64.strict_encode64(sha512.digest)
end

def get_file_size(path)
  path.size
end

def get_release_date
  Time.now.utc.strftime('%Y-%m-%dT%H:%M:%S.000Z')
end

def parse_release_filename(path)
  match = VERSION_PATTERN.match(path.basename.to_s)
  return nil unless match

  {
    'version' => match[:version],
    'extension' => match[:extension].downcase
  }
end

def find_release_files(release_directory)
  files = []
  release_directory.children.each do |path|
    next unless path.file?
    next unless SUPPORTED_EXTENSIONS.include?(path.extname.downcase)

    parsed = parse_release_filename(path)
    if parsed.nil?
      raise ArgumentError, "Invalid release filename: #{path.basename}\n" \
                           "Expected format:\n" \
                           "PackName_vx.x.x-versionstatus.x.mcaddon"
    end

    files << {
      'path' => path,
      'version' => parsed['version'],
      'extension' => parsed['extension']
    }
  end
  files
end

def validate_versions(files)
  versions = files.map { |f| f['version'] }.uniq
  return unless versions.size > 1

  formatted = files.map { |f| " #{f['path'].basename}: #{f['version']}" }.join("\n")
  raise ArgumentError, "Release files contain different versions:\n#{formatted}"
end

def yaml_string(value)
  escaped = value.gsub('\\', '\\\\').gsub("'", "''")
  "'#{escaped}'"
end

def generate_latest_yml(files, output_path)
  mcaddon = files.find { |f| f['extension'] == 'mcaddon' }
  raise ArgumentError, 'No .mcaddon file was found.' if mcaddon.nil?

  version = files[0]['version']
  release_date = get_release_date
  output = []
  output << "version: #{version}"
  output << 'files:'

  files.each do |file|
    path = file['path']
    sha512 = calculate_sha512(path)
    size = get_file_size(path)
    output << "  - url: #{path.basename}"
    output << "    sha512: #{sha512}"
    output << "    size: #{size}"
  end

  mcaddon_path = mcaddon['path']
  mcaddon_hash = calculate_sha512(mcaddon_path)
  output << "path: #{mcaddon_path.basename}"
  output << "sha512: #{mcaddon_hash}"
  output << "releaseDate: #{yaml_string(release_date)}"

  output_path.write(output.join("\n") + "\n", mode: 'w:utf-8')
  [version, release_date]
end

def main
  options = {
    directory: Pathname.new('builds/releases'),
    output: nil
  }

  OptionParser.new do |opts|
    opts.banner = 'Generate latest.yml for a Vantage release.'
    opts.on('-d', '--directory DIRECTORY', 'Directory containing release files (default: builds/releases)') do |d|
      options[:directory] = Pathname.new(d)
    end
    opts.on('-o', '--output OUTPUT', 'Output path for latest.yml (default: <directory>/latest.yml)') do |o|
      options[:output] = Pathname.new(o)
    end
  end.parse!

  release_directory = options[:directory].expand_path.cleanpath

  unless release_directory.exist?
    warn "ERROR: Release directory does not exist:\n  #{release_directory}"
    return 1
  end

  unless release_directory.directory?
    warn "ERROR: Not a directory:\n  #{release_directory}"
    return 1
  end

  output_path = if options[:output]
                  options[:output].expand_path.cleanpath
                else
                  release_directory.join('latest.yml')
                end

  begin
    files = find_release_files(release_directory)
    raise ArgumentError, 'No .mcaddon or .brproject files were found.' if files.empty?

    validate_versions(files)
    version, release_date = generate_latest_yml(files, output_path)
  rescue StandardError => e
    warn "ERROR: #{e.message}"
    return 1
  end

  puts
  puts '✓ Release detected'
  puts "  Version: #{version}"
  puts "  Release date: #{release_date}"
  puts

  files.each do |file|
    path = file['path']
    sha512 = calculate_sha512(path)
    size = get_file_size(path)
    puts "✓ #{path.basename}"
    formatted_size = size.to_s.gsub(/(\d)(?=(\d{3})+(?!\d))/, '\1,')
    puts "  Size: #{formatted_size} bytes"
    puts "  SHA512: #{sha512}"
  end

  puts
  puts '✓ Generated:'
  puts "  #{output_path}"
  0
end

if __FILE__ == $PROGRAM_NAME
  exit_code = main
  exit(exit_code)
end
