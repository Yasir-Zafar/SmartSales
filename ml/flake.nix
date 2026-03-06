{
  description = "SmartSales ML Service";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    python = pkgs.python314;
  in {
    devShells.${system}.default = pkgs.mkShell {
      buildInputs = [
        python
        python.pkgs.pip
        python.pkgs.fastapi
        python.pkgs.uvicorn
        python.pkgs.pandas
        python.pkgs.scikit-learn
        python.pkgs.pydantic
        python.pkgs.requests
        python.pkgs.python-dotenv
        python.pkgs.psycopg2
        pkgs.uv
      ];

      shellHook = ''
        export PYTHONPATH=$PWD

        if [ ! -d "venv" ]; then
          uv venv venv --python 3.14
        fi

        source venv/bin/activate
        uv pip install supabase
      '';
    };
  };
}